const { Router } = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireFirebaseAuth = require('../../middleware/requireFirebaseAuth');
const requireRole = require('../../middleware/requireRole');
const orderController = require('./order.controller');

const router = Router();

// Create order (client via Firebase, or guest — no auth needed for guest)
router.post(
  '/',
  [
    body('location_id').isInt({ gt: 0 }).withMessage('Valid location_id required.'),
    validateRequest,
  ],
  orderController.create
);

// Add item to order
router.post(
  '/:id/items',
  [
    param('id').isInt({ gt: 0 }),
    body('item_id').isInt({ gt: 0 }).withMessage('Valid item_id required.'),
    body('quantity').optional().isInt({ gt: 0 }).withMessage('Quantity must be positive.'),
    validateRequest,
  ],
  orderController.addItem
);

// Add option to order item
router.post(
  '/:id/items/:itemId/options',
  [
    param('itemId').isInt({ gt: 0 }),
    body('item_option_value_id').isInt({ gt: 0 }).withMessage('Valid item_option_value_id required.'),
    validateRequest,
  ],
  orderController.addItemOption
);

// Remove item from order
router.delete(
  '/:id/items/:itemId',
  [param('itemId').isInt({ gt: 0 }), validateRequest],
  orderController.removeItem
);

// Calculate order total
router.post(
  '/:id/calculate',
  [param('id').isInt({ gt: 0 }), validateRequest],
  orderController.calculateTotal
);

// Get order by tracking code (public — UUID is the secret)
router.get(
  '/track/:trackingCode',
  [param('trackingCode').isUUID().withMessage('Invalid tracking code.'), validateRequest],
  orderController.getByTrackingCode
);

// Get order by ID
router.get(
  '/:id',
  [param('id').isInt({ gt: 0 }), validateRequest],
  orderController.getById
);

// Get order items
router.get(
  '/:id/items',
  [param('id').isInt({ gt: 0 }), validateRequest],
  orderController.getItems
);

// Update order status (staff only)
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    param('id').isInt({ gt: 0 }),
    body('status').isIn(['PAID', 'PREPARING', 'READY', 'COMPLETED']).withMessage('Invalid status.'),
    validateRequest,
  ],
  orderController.updateStatus
);

// Send order back to the queue with high priority (staff edge-case handling)
router.post(
  '/:id/priority',
  requireAuth,
  requireRole('admin', 'manager', 'staff'),
  [
    param('id').isInt({ gt: 0 }),
    body('reason').isString().trim().isLength({ min: 3 }).withMessage('A justification note is required.'),
    validateRequest,
  ],
  orderController.prioritize
);

// Cancel order (refunds via Stripe if the order was already paid)
router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('admin', 'manager', 'staff'),
  [
    param('id').isInt({ gt: 0 }),
    body('reason').isString().trim().isLength({ min: 3 }).withMessage('A cancellation reason is required.'),
    validateRequest,
  ],
  orderController.cancel
);

// DEV ONLY: Simulate payment (skips Stripe) — disabled in production
if (process.env.NODE_ENV !== 'production') {
  router.post(
    '/:id/simulate-pay',
    [param('id').isInt({ gt: 0 }), validateRequest],
    orderController.simulatePay
  );
}

// List my orders (client via Firebase)
router.get(
  '/',
  requireFirebaseAuth,
  orderController.listMyOrders
);

module.exports = router;
