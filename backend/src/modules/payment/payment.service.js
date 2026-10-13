const stripe = require('../../config/stripe');
const db = require('../../config/db');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { getIO } = require('../../sockets');
const deliveryService = require('../delivery/delivery.service');

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
  // Never charge against an expired delivery quote. The client handles the
  // DELIVERY_QUOTE_EXPIRED code by refreshing the quote and retrying.
  if (order.fulfillment_type === 'DELIVERY') {
    await deliveryService.assertOrderQuoteValid(orderId);
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

    if (order && ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(order.status_name)) {
      const io = getIO();
      if (io) {
        io.of('/kitchen').to(`location_${order.location_id}`).emit('order_paid', {
          order_id: orderId,
          location_id: order.location_id,
          status: 'PAID',
          timestamp: Date.now(),
        });
      }
      // Payment succeeded -> request the courier. Idempotent with the
      // /payments/confirm path below: only one of them actually dispatches.
      if (order.fulfillment_type === 'DELIVERY') deliveryService.dispatchInBackground(orderId);
    }
  }

  return { received: true };
}

/**
 * Fallback path called by the frontend immediately after a successful
 * stripe.confirmPayment(), or after returning from a redirect method.
 * Verifies the PaymentIntent with Stripe,
 * then marks the order PAID. Idempotent: sp_order_mark_paid is safe to
 * call twice if the webhook also lands.
 */
async function confirmPayment(orderId, paymentIntentId) {
  if (!stripe) throw new AppError('Stripe not configured.', 500);
  if (!orderId || !paymentIntentId) {
    throw new AppError('order_id and payment_intent_id are required.', 400);
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (parseInt(intent.metadata.order_id, 10) !== parseInt(orderId, 10)) {
    throw new AppError('PaymentIntent does not belong to this order.', 400);
  }
  if (intent.status !== 'succeeded') {
    return { order_id: parseInt(orderId, 10), status: intent.status };
  }

  const beforeResult = await db.call('sp_order_get', [orderId]);
  const beforeRows = Array.isArray(beforeResult[0]) ? beforeResult[0] : beforeResult;
  const before = beforeRows[0];
  if (!before) throw new AppError('Order not found.', 404);
  if (before.status_name === 'CANCELED') {
    throw new AppError('This order was canceled. Please contact the store about your payment.', 409);
  }
  if (intent.currency !== 'usd' || intent.amount_received !== Math.round(Number(before.total_amount) * 100)) {
    throw new AppError('Payment amount does not match this order. Please contact the store.', 409);
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

  if (order && ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(order.status_name)) {
    const io = getIO();
    if (io) {
      io.of('/kitchen').to(`location_${order.location_id}`).emit('order_paid', {
        order_id: parseInt(orderId, 10),
        location_id: order.location_id,
        status: 'PAID',
        timestamp: Date.now(),
      });
    }
    if (order.fulfillment_type === 'DELIVERY') {
      deliveryService.dispatchInBackground(parseInt(orderId, 10));
    }
  }

  return { order_id: parseInt(orderId, 10), status: 'PAID' };
}

/**
 * Issue a full Stripe refund for an order and flip the payment row to
 * 'refunded'. Returns the refund record. Caller is responsible for
 * cancelling the order (sp_order_cancel) after this resolves.
 */
async function refundOrder(orderId, { allowUnpaid = false } = {}) {
  if (!stripe) {
    if (allowUnpaid) return null;
    throw new AppError('Stripe not configured.', 500);
  }

  const payResult = await db.call('sp_payment_get_by_order', [orderId]);
  const payRows = Array.isArray(payResult[0]) ? payResult[0] : payResult;
  const payment = payRows[0];

  if (!payment || allowUnpaid) {
    if (allowUnpaid) {
      const orderResult = await db.call('sp_order_get', [orderId]);
      const orderRows = Array.isArray(orderResult[0]) ? orderResult[0] : orderResult;
      const createdAt = new Date(orderRows[0]?.created_at).getTime();
      if (!Number.isFinite(createdAt)) throw new AppError('Cannot verify payment history for this order.', 409);

      // List rather than Search: Stripe Search is eventually consistent. Scan
      // from before order creation, including all pages and all matching intents.
      const intents = [];
      for await (const intent of stripe.paymentIntents.list({
        created: { gte: Math.max(0, Math.floor(createdAt / 1000) - 86400) }, limit: 100,
      })) {
        if (intent.metadata.order_id === String(orderId)) intents.push(intent);
      }
      // Stop future charges before canceling the order. Processing payments
      // require reconciliation; never assume they are abandoned checkouts.
      for (const intent of intents) {
        if (intent.status === 'processing' || intent.status === 'requires_capture') {
          throw new AppError('Payment is still processing. Check Stripe before canceling this order.', 409);
        }
      }
      for (const intent of intents) {
        if (!['succeeded', 'canceled'].includes(intent.status)) {
          await stripe.paymentIntents.cancel(intent.id);
        }
      }
      const refunds = [];
      for (const intent of intents.filter((item) => item.status === 'succeeded')) {
        const verified = await stripe.paymentIntents.retrieve(intent.id, { expand: ['latest_charge'] });
        const charge = verified.latest_charge;
        if (!charge || typeof charge === 'string') throw new AppError('Cannot verify charge for refund.', 502);
        let refund = null;
        if (!charge.refunded) {
          refund = await stripe.refunds.create({ payment_intent: intent.id }, {
            idempotencyKey: `order-cancel-refund:${orderId}:${intent.id}`,
          });
          if (!['succeeded', 'pending'].includes(refund.status)) {
            throw new AppError(`Stripe refund failed with status ${refund.status}.`, 502);
          }
        }
        await record({ orderId, stripePaymentIntentId: intent.id,
          amount: intent.amount_received / 100, currency: intent.currency.toUpperCase(), status: 'refunded' });
        refunds.push(refund ? { refund_id: refund.id, status: refund.status, amount: refund.amount / 100 } : { already_refunded: true });
      }
      return refunds.length ? { refunds } : null;
    }
    throw new AppError('No payment found for this order — nothing to refund.', 404);
  }
  if (payment.status === 'refunded') {
    return { already_refunded: true, payment };
  }

  const refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
  }, {
    idempotencyKey: `order-cancel-refund:${orderId}:${payment.stripe_payment_intent_id}`,
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
