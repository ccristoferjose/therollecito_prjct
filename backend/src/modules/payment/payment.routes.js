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

  // Distinguish "Stripe is intentionally off" from "Stripe is set up wrong".
  //
  // Those need OPPOSITE handling. No keys at all is a legitimate local setup and
  // should fall back to simulated payment. But keys that are present and broken
  // must NOT simulate: silently inventing a paid order hides the misconfiguration
  // and produces fake revenue. That case reports config_error so checkout can
  // refuse and say why.
  //
  // The failure this catches: pasting a whsec_... webhook secret into
  // STRIPE_PUBLISHABLE_KEY. loadStripe() still resolves a stripe object, so the
  // Pay button enables, but the PaymentElement can never mount — surfacing only
  // on click as "elements should have a mounted Payment Element".
  const publishableKey = env.stripe.publishableKey || null;
  const keyLooksValid = /^pk_(test|live)_/.test(publishableKey || '');

  let configError = null;
  if (stripe && !publishableKey) {
    configError =
      'STRIPE_SECRET_KEY is set but STRIPE_PUBLISHABLE_KEY is missing. Stripe cannot be used from the browser.';
  } else if (stripe && !keyLooksValid) {
    configError =
      `STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_ (got "${publishableKey.slice(0, 8)}..."). ` +
      'The webhook secret and the publishable key are easy to transpose in backend/.env.';
  }

  if (configError) console.error(`[payments] ${configError}`);

  res.json({
    // True only when Stripe is genuinely usable end to end.
    stripe_configured: !!stripe && keyLooksValid,
    publishable_key: keyLooksValid ? publishableKey : null,
    // Present ONLY when Stripe was meant to work but cannot. The client must
    // block checkout on this rather than falling back to simulation.
    config_error: configError,
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
