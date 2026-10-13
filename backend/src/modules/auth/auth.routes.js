const { Router } = require('express');
const { body } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireFirebaseAuth = require('../../middleware/requireFirebaseAuth');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const authController = require('./auth.controller');

const router = Router();

// Staff login (JWT)
router.post(
  '/staff/login',
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
    validateRequest,
  ],
  authController.staffLogin
);

// Client: get current user (Firebase auth → auto-create)
router.post('/staff/refresh', requireAuth, requireRole('admin', 'manager'), authController.refreshStaffSession);

router.get('/me', requireFirebaseAuth, authController.getMe);

module.exports = router;
