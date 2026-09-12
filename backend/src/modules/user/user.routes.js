const { Router } = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const userController = require('./user.controller');

const router = Router();

// List staff users (admin only)
router.get(
  '/staff',
  requireAuth,
  requireRole('admin'),
  userController.listStaff
);

// --- Clients directory (admin only) ---------------------------------------
// List all client-role users with order aggregates. Optional ?search=.
router.get(
  '/clients',
  requireAuth,
  requireRole('admin'),
  userController.listClients
);

// One client's profile + full order history (with statuses).
router.get(
  '/clients/:id/orders',
  requireAuth,
  requireRole('admin'),
  [param('id').isInt({ gt: 0 }).withMessage('Valid client id required.'), validateRequest],
  userController.getClientOrders
);

// Create staff account (admin only)
router.post(
  '/staff',
  requireAuth,
  requireRole('admin'),
  [
    body('email').isEmail().withMessage('Valid email required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('firstName').notEmpty().withMessage('First name required.'),
    body('lastName').notEmpty().withMessage('Last name required.'),
    body('role').isIn(['admin', 'manager']).withMessage('Role must be admin or manager.'),
    validateRequest,
  ],
  userController.createStaff
);

// Update staff user info (admin only)
router.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  userController.updateStaff
);

// Update user role (admin only)
router.patch(
  '/:id/role',
  requireAuth,
  requireRole('admin'),
  [
    body('role_id').isInt({ gt: 0 }).withMessage('Valid role_id required.'),
    validateRequest,
  ],
  userController.updateRole
);

// Change staff password (admin only)
router.patch(
  '/:id/password',
  requireAuth,
  requireRole('admin'),
  [
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    validateRequest,
  ],
  userController.changePassword
);

// Toggle staff active/inactive (admin only)
router.patch(
  '/:id/active',
  requireAuth,
  requireRole('admin'),
  [
    body('is_active').isBoolean().withMessage('is_active must be boolean.'),
    validateRequest,
  ],
  userController.toggleActive
);

// Delete staff (admin only — must be disabled first)
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  userController.deleteStaff
);

module.exports = router;
