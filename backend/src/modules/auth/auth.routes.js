const { Router } = require('express');
const { body } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireFirebaseAuth = require('../../middleware/requireFirebaseAuth');
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
router.get('/me', requireFirebaseAuth, authController.getMe);

module.exports = router;
