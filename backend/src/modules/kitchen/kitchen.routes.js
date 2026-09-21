const { Router } = require('express');
const { query } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const kitchenController = require('./kitchen.controller');

const router = Router();

// Kitchen board — queue / upcoming / preparing / ready, plus a collapsed
// "later today" list and a count of future-dated orders. Replaces the three
// per-status /orders calls the board used to make on every poll.
router.get(
  '/board',
  requireAuth,
  requireRole('admin', 'manager', 'staff'),
  [
    query('location_id').isInt({ gt: 0 }).withMessage('Valid location_id required.'),
    query('upcoming_window').optional().isInt({ min: 0, max: 1440 })
      .withMessage('upcoming_window must be 0-1440 minutes.'),
    validateRequest,
  ],
  kitchenController.getBoard
);

// Future-dated orders (tomorrow onwards) for the Scheduled page.
router.get(
  '/scheduled',
  requireAuth,
  requireRole('admin', 'manager', 'staff'),
  [
    query('location_id').isInt({ gt: 0 }).withMessage('Valid location_id required.'),
    query('date_from').optional({ checkFalsy: true }).isISO8601().withMessage('date_from must be YYYY-MM-DD.'),
    query('date_to').optional({ checkFalsy: true }).isISO8601().withMessage('date_to must be YYYY-MM-DD.'),
    validateRequest,
  ],
  kitchenController.getScheduled
);

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
