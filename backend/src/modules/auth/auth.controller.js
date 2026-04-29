const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');

/**
 * POST /api/auth/staff/login
 * Body: { email, password }
 */
const staffLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.staffLogin(email, password);
  res.json(result);
});

/**
 * GET /api/auth/me
 * Returns the current user from the Firebase middleware (req.user).
 */
const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { staffLogin, getMe };
