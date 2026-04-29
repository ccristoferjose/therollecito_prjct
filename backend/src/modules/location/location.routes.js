const { Router } = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const locationController = require('./location.controller');

const router = Router();

// Public: list active locations
router.get('/', locationController.listActive);

// Admin: list ALL locations (including inactive)
router.get('/all', requireAuth, requireRole('admin'), locationController.listAll);

// Admin: create location
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [
    body('name').notEmpty().withMessage('Name required.'),
    body('address').notEmpty().withMessage('Address required.'),
    body('city').notEmpty(),
    body('state').notEmpty(),
    body('zipCode').notEmpty(),
    validateRequest,
  ],
  locationController.create
);

// Admin: update location
router.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  locationController.update
);

// Admin: toggle location active/inactive
router.patch(
  '/:id/active',
  requireAuth,
  requireRole('admin'),
  [
    param('id').isInt({ gt: 0 }),
    body('is_active').isBoolean(),
    validateRequest,
  ],
  locationController.toggleActive
);

module.exports = router;
