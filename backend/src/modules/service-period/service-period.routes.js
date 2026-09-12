const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./service-period.controller');

const router = Router();

// Pickup times are restaurant-LOCAL wall clock with no offset
// ("2026-09-12T15:30:00"). isISO8601 accepts that, matching the existing
// pickup_time rule on the order routes.

// ---------------------------------------------------------------------------
// Public — the customer's pickup-time-first flow
// ---------------------------------------------------------------------------

// Which period/menu applies at a pickup time.
router.get(
  '/location/:locationId/resolve',
  [
    param('locationId').isInt({ gt: 0 }),
    query('pickupTime').optional({ nullable: true, checkFalsy: true }).isISO8601()
      .withMessage('pickupTime must be an ISO 8601 datetime.'),
    validateRequest,
  ],
  controller.resolve,
);

// The location's published schedule: every active period with its weekly hours.
//
// Public on purpose — "we serve breakfast 7:00-11:00" is exactly what a customer
// needs to see on the marketing pages, and it lets those pages stay correct on
// their own when an admin edits a period. Distinct from /bookable, which answers
// the narrower "what can I still order for TODAY" and hides windows that have
// already passed. Nothing sensitive here: period names, times and menu names.
router.get(
  '/location/:locationId/schedule',
  [param('locationId').isInt({ gt: 0 }), validateRequest],
  controller.listByLocation,
);

// Periods still bookable on a date — drives the pickup picker.
router.get(
  '/location/:locationId/bookable',
  [
    param('locationId').isInt({ gt: 0 }),
    query('date').optional({ nullable: true, checkFalsy: true }).isISO8601()
      .withMessage('date must be YYYY-MM-DD.'),
    validateRequest,
  ],
  controller.listBookable,
);

// Re-check a cart against a (new) pickup time. Returns the items that are not
// available then; the client flags them rather than removing them.
router.post(
  '/location/:locationId/validate-cart',
  [
    param('locationId').isInt({ gt: 0 }),
    body('item_ids').isArray().withMessage('item_ids must be an array.'),
    body('pickup_time').optional({ nullable: true, checkFalsy: true }).isISO8601()
      .withMessage('pickup_time must be an ISO 8601 datetime.'),
    validateRequest,
  ],
  controller.validateCart,
);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

router.get(
  '/location/:locationId',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('locationId').isInt({ gt: 0 }), validateRequest],
  controller.listByLocation,
);

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    body('location_id').isInt({ gt: 0 }),
    body('menu_id').isInt({ gt: 0 }),
    body('name').notEmpty().withMessage('Service period name required.'),
    body('prep_time_minutes').optional().isInt({ min: 0 }),
    body('sort_order').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  controller.create,
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    param('id').isInt({ gt: 0 }),
    body('menu_id').optional().isInt({ gt: 0 }),
    body('prep_time_minutes').optional().isInt({ min: 0 }),
    body('sort_order').optional().isInt({ min: 0 }),
    body('is_active').optional().isBoolean(),
    validateRequest,
  ],
  controller.update,
);

// Upsert one weekday's hours. day_of_week follows MySQL DAYOFWEEK():
// 1 = Sunday .. 7 = Saturday.
router.put(
  '/:id/schedule',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    param('id').isInt({ gt: 0 }),
    body('day_of_week').isInt({ min: 1, max: 7 })
      .withMessage('day_of_week must be 1 (Sunday) through 7 (Saturday).'),
    body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/)
      .withMessage('start_time must be HH:MM or HH:MM:SS.'),
    body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/)
      .withMessage('end_time must be HH:MM or HH:MM:SS.'),
    validateRequest,
  ],
  controller.setSchedule,
);

// Clearing a weekday marks the period closed that day.
router.delete(
  '/:id/schedule/:dayOfWeek',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    param('id').isInt({ gt: 0 }),
    param('dayOfWeek').isInt({ min: 1, max: 7 }),
    validateRequest,
  ],
  controller.clearSchedule,
);

// Deactivates instead of deleting when order history references the period.
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  controller.remove,
);

module.exports = router;
