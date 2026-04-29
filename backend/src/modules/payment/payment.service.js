const stripe = require('../../config/stripe');
const db = require('../../config/db');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { getIO } = require('../../sockets');

/**
 * Create a Stripe PaymentIntent for an order.
 * The frontend uses the client_secret to complete payment.
 */
async function createIntent(orderId) {
  if (!stripe) throw new AppError('Stripe not configured.', 422);

  // Get order to verify it exists and get total
  const result = await db.call('sp_order_get', [orderId]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const order = rows[0];

  if (!order) throw new AppError('Order not found.', 404);
  if (order.status_name !== 'CREATED') {
    throw new AppError('Order is not in CREATED status.', 400);
  }
  if (order.total_amount <= 0) {
    throw new AppError('Order total must be greater than zero. Calculate total first.', 400);
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.total_amount * 100), // Stripe uses cents
    currency: 'usd',
    metadata: { order_id: String(orderId) },
    // Let Stripe surface every payment method enabled on the dashboard
    // (card, Apple Pay, Google Pay, Link, Cash App, Klarna, etc.). The
    // frontend PaymentElement will render the appropriate UI.
    automatic_payment_methods: { enabled: true },
  });

  return {
    client_secret: paymentIntent.client_secret,
    payment_intent_id: paymentIntent.id,
    amount: order.total_amount,
  };
}

/**
 * Handle Stripe webhook events.
 * Called with the raw body and Stripe-Signature header.
 */
async function handleWebhook(rawBody, signature) {
  if (!stripe) throw new AppError('Stripe not configured.', 500);

  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    env.stripe.webhookSecret
  );

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const orderId = parseInt(intent.metadata.order_id, 10);

    if (!orderId) return { received: true };

    // Idempotent: sp_order_mark_paid checks for existing payment
    const result = await db.call('sp_order_mark_paid', [
      orderId,
      intent.id,
      intent.amount / 100, // Convert cents back to dollars
      intent.currency.toUpperCase(),
    ]);

    // Emit real-time event
    const orderResult = await db.call('sp_order_get', [orderId]);
    const orderRows = Array.isArray(orderResult[0]) ? orderResult[0] : orderResult;
    const order = orderRows[0];

    if (order) {
      const io = getIO();
      if (io) {
        io.of('/kitchen').to(`location_${order.location_id}`).emit('order_paid', {
          order_id: orderId,
          location_id: order.location_id,
          status: 'PAID',
          timestamp: Date.now(),
        });
      }
    }
  }

  return { received: true };
}

/**
 * Fallback path called by the frontend immediately after a successful
 * stripe.confirmCardPayment(). Verifies the PaymentIntent with Stripe,
 * then marks the order PAID. Idempotent: sp_order_mark_paid is safe to
 * call twice if the webhook also lands.
 */
async function confirmPayment(orderId, paymentIntentId) {
  if (!stripe) throw new AppError('Stripe not configured.', 500);
  if (!orderId || !paymentIntentId) {
    throw new AppError('order_id and payment_intent_id are required.', 400);
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (intent.status !== 'succeeded') {
    throw new AppError(`PaymentIntent is ${intent.status}, not succeeded.`, 400);
  }
  if (parseInt(intent.metadata.order_id, 10) !== parseInt(orderId, 10)) {
    throw new AppError('PaymentIntent does not belong to this order.', 400);
  }

  await db.call('sp_order_mark_paid', [
    orderId,
    intent.id,
    intent.amount / 100,
    intent.currency.toUpperCase(),
  ]);

  const orderResult = await db.call('sp_order_get', [orderId]);
  const orderRows = Array.isArray(orderResult[0]) ? orderResult[0] : orderResult;
  const order = orderRows[0];

  if (order) {
    const io = getIO();
    if (io) {
      io.of('/kitchen').to(`location_${order.location_id}`).emit('order_paid', {
        order_id: parseInt(orderId, 10),
        location_id: order.location_id,
        status: 'PAID',
        timestamp: Date.now(),
      });
    }
  }

  return { order_id: parseInt(orderId, 10), status: 'PAID' };
}

/**
 * Issue a full Stripe refund for an order and flip the payment row to
 * 'refunded'. Returns the refund record. Caller is responsible for
 * cancelling the order (sp_order_cancel) after this resolves.
 */
async function refundOrder(orderId) {
  if (!stripe) throw new AppError('Stripe not configured.', 500);

  const payResult = await db.call('sp_payment_get_by_order', [orderId]);
  const payRows = Array.isArray(payResult[0]) ? payResult[0] : payResult;
  const payment = payRows[0];

  if (!payment) {
    throw new AppError('No payment found for this order — nothing to refund.', 404);
  }
  if (payment.status === 'refunded') {
    return { already_refunded: true, payment };
  }

  const refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
  });

  if (refund.status !== 'succeeded' && refund.status !== 'pending') {
    throw new AppError(`Stripe refund failed with status ${refund.status}.`, 502);
  }

  await db.call('sp_payment_mark_refunded', [orderId]);

  return { refund_id: refund.id, status: refund.status, amount: refund.amount / 100 };
}

/**
 * Record a payment directly (for testing or manual reconciliation).
 */
async function record({ orderId, stripePaymentIntentId, amount, currency, status }) {
  const result = await db.call('sp_payment_record', [
    orderId,
    stripePaymentIntentId,
    amount,
    currency || 'USD',
    status || 'succeeded',
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

module.exports = { createIntent, handleWebhook, confirmPayment, refundOrder, record };
