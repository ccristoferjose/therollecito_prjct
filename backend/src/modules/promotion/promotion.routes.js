const { Router } = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const promotionController = require('./promotion.controller');

const router = Router();

// Admin: list all promotions
router.get('/', requireAuth, requireRole('admin'), promotionController.list);

// Admin: create promotion
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [
    body('code').notEmpty().withMessage('Code required.'),
    body('discountType').isIn(['percentage', 'fixed']).withMessage('Must be percentage or fixed.'),
    body('discountValue').isFloat({ gt: 0 }).withMessage('Value must be > 0.'),
    body('startsAt').notEmpty().withMessage('Start date required.'),
    validateRequest,
  ],
  promotionController.create
);

// Admin: update promotion
router.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  promotionController.update
);

// Admin: delete promotion
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  promotionController.remove
);

// Public: apply a promo code (DESTRUCTIVE — bumps current_uses)
router.post(
  '/apply',
  [
    body('code').notEmpty().withMessage('Code required.'),
    body('order_total').isFloat({ gt: 0 }).withMessage('Order total required.'),
    validateRequest,
  ],
  promotionController.apply
);

// Public: preview a promo code — same validation, no usage increment.
// Used by the checkout UI to display the discount before the customer pays.
router.post(
  '/preview',
  [
    body('code').notEmpty().withMessage('Code required.'),
    body('order_total').isFloat({ gt: 0 }).withMessage('Order total required.'),
    validateRequest,
  ],
  promotionController.preview
);

module.exports = router;
