const { Router } = require('express');
const { query } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const kitchenController = require('./kitchen.controller');

const router = Router();

// Get kitchen orders with items (staff only)
router.get(
  '/orders',
  requireAuth,
  requireRole('admin', 'manager', 'staff'),
  [
    query('location_id').isInt({ gt: 0 }).withMessage('Valid location_id required.'),
    query('status').optional().isIn(['PAID', 'PREPARING', 'READY']),
    validateRequest,
  ],
  kitchenController.getOrders
);

// Get order counts per status (for tab badges)
router.get(
  '/counts',
  requireAuth,
  requireRole('admin', 'manager', 'staff'),
  [
    query('location_id').isInt({ gt: 0 }).withMessage('Valid location_id required.'),
    validateRequest,
  ],
  kitchenController.getCounts
);

// Get order history with filters
router.get(
  '/history',
  requireAuth,
  requireRole('admin', 'manager', 'staff'),
  [
    query('location_id').isInt({ gt: 0 }).withMessage('Valid location_id required.'),
    validateRequest,
  ],
  kitchenController.getHistory
);

module.exports = router;
