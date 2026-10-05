const { Router } = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const deliveryController = require('./delivery.controller');
const { US_STATES, ZIP_RE } = require('./delivery.address');

const router = Router();

// Whether checkout should offer Delivery at all (provider configured + enabled),
// and the minimum subtotal for delivery.
router.get('/status', deliveryController.status);

// Admin: delivery pricing settings (minimum order + customer/restaurant split).
router.get('/settings', requireAuth, requireRole('admin'), deliveryController.getSettings);
router.put(
  '/settings',
  requireAuth,
  requireRole('admin'),
  [
    body('min_order_amount').optional().isFloat({ min: 0, max: 10000 })
      .withMessage('Minimum order must be between $0 and $10,000.'),
    body('customer_fee_percent').optional().isFloat({ min: 0, max: 100 })
      .withMessage('Customer share must be between 0% and 100%.'),
    body('fee_split_mode').optional().isIn(['PERCENT', 'FLAT'])
      .withMessage('Split mode must be PERCENT or FLAT.'),
    body('restaurant_flat_amount').optional().isFloat({ min: 0, max: 100 })
      .withMessage('Restaurant amount must be between $0 and $100.'),
    validateRequest,
  ],
  deliveryController.updateSettings
);

// Price a delivery to the customer's address from the selected location.
// The restaurant's own address/coordinates are resolved server-side.
router.post(
  '/quote',
  [
    body('location_id').isInt({ gt: 0 }).withMessage('Valid location_id required.'),
    body('address').isObject().withMessage('address is required.'),
    body('address.street_address').isString().trim().isLength({ min: 3, max: 255 })
      .withMessage('Street address is required.'),
    body('address.apartment').optional({ nullable: true, checkFalsy: true }).isString().trim()
      .isLength({ max: 100 }).withMessage('Apartment / unit is too long.'),
    body('address.city').isString().trim().isLength({ min: 2, max: 100 }).withMessage('City is required.'),
    body('address.state').isString().trim().toUpperCase().isIn(US_STATES)
      .withMessage('State must be a valid US state.'),
    body('address.zip_code').isString().trim().matches(ZIP_RE).withMessage('ZIP code must be 5 digits.'),
    body('pickup_time').optional({ nullable: true, checkFalsy: true }).isISO8601()
      .withMessage('pickup_time must be an ISO 8601 datetime.'),
    body('subtotal').optional({ nullable: true }).isFloat({ min: 0, max: 100000 })
      .withMessage('subtotal must be a positive amount.'),
    validateRequest,
  ],
  deliveryController.quote
);

// Before payment: keep, silently renew, or re-price an expired quote.
router.post(
  '/orders/:orderId/refresh-quote',
  [param('orderId').isInt({ gt: 0 }), validateRequest],
  deliveryController.refreshOrderQuote
);

// The customer accepted an updated delivery price.
router.post(
  '/orders/:orderId/accept-quote',
  [
    param('orderId').isInt({ gt: 0 }),
    body('quote_id').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('quote_id required.'),
    validateRequest,
  ],
  deliveryController.acceptOrderQuote
);

// Staff: retry requesting a courier after a failed dispatch.
router.post(
  '/orders/:orderId/dispatch',
  requireAuth,
  requireRole('admin', 'manager', 'staff'),
  [param('orderId').isInt({ gt: 0 }), validateRequest],
  deliveryController.retryDispatch
);

// Provider webhooks (raw body — see app.js). Mounted at /api/webhooks.
const webhookRouter = Router();
webhookRouter.post('/uber', deliveryController.uberWebhook);

module.exports = { router, webhookRouter };
