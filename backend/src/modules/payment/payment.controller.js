const asyncHandler = require('../../utils/asyncHandler');
const paymentService = require('./payment.service');

const createIntent = asyncHandler(async (req, res) => {
  const result = await paymentService.createIntent(req.body.order_id);
  res.json(result);
});

/**
 * Stripe sends the raw body — express.raw() is mounted in app.js
 * before express.json() for this specific route.
 */
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const result = await paymentService.handleWebhook(req.body, signature);
  res.json(result);
});

const confirm = asyncHandler(async (req, res) => {
  const result = await paymentService.confirmPayment(
    req.body.order_id,
    req.body.payment_intent_id
  );
  res.json(result);
});

const record = asyncHandler(async (req, res) => {
  const result = await paymentService.record({
    orderId: req.body.order_id,
    stripePaymentIntentId: req.body.stripe_payment_intent_id,
    amount: req.body.amount,
    currency: req.body.currency,
    status: req.body.status,
  });
  res.json(result);
});

module.exports = { createIntent, webhook, confirm, record };
