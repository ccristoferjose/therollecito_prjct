const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Verifies the JWT in the Authorization header.
 * Attaches decoded payload to req.user: { user_id, role, location_id }
 */
function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication required.', 401));
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded;
    next();
  } catch {
    next(new AppError('Invalid or expired token.', 401));
  }
}

module.exports = requireAuth;
