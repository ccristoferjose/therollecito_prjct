const { Router } = require('express');
const { body } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const paymentController = require('./payment.controller');

const router = Router();

// Create Stripe PaymentIntent
router.post(
  '/create-intent',
  [
    body('order_id').isInt({ gt: 0 }).withMessage('Valid order_id required.'),
    validateRequest,
  ],
  paymentController.createIntent
);

// Stripe webhook (raw body — handled by express.raw in app.js)
router.post('/webhook', paymentController.webhook);

// Frontend fallback: called after stripe.confirmCardPayment succeeds so we
// don't rely solely on the webhook. Idempotent with the webhook path.
router.post(
  '/confirm',
  [
    body('order_id').isInt({ gt: 0 }).withMessage('Valid order_id required.'),
    body('payment_intent_id').isString().notEmpty().withMessage('payment_intent_id required.'),
    validateRequest,
  ],
  paymentController.confirm
);

// Check if Stripe is configured and return publishable key for the frontend.
// Also exposes the processing-fee rates so the cart can preview the fee
// before the order is created (the server is the canonical source — frontend
// only previews, server-side sp_order_calculate_total stamps the real value).
router.get('/status', (_req, res) => {
  const stripe = require('../../config/stripe');
  const env = require('../../config/env');
  res.json({
    stripe_configured: !!stripe,
    publishable_key: env.stripe.publishableKey || null,
    fee_percent: env.stripe.feePercent,
    fee_fixed: env.stripe.feeFixed,
  });
});

// Manual payment record (admin only — for reconciliation)
router.post(
  '/record',
  requireAuth,
  requireRole('admin'),
  [
    body('order_id').isInt({ gt: 0 }),
    body('stripe_payment_intent_id').notEmpty(),
    body('amount').isFloat({ gt: 0 }),
    validateRequest,
  ],
  paymentController.record
);

module.exports = router;
