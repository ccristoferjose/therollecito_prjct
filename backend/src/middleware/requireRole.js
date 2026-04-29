const AppError = require('../utils/AppError');

/**
 * Factory: returns middleware that checks req.user.role against allowed roles.
 * Usage: requireRole('admin', 'manager')
 */
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const userRole = req.user.role || req.user.role_name;

    if (!allowedRoles.includes(userRole)) {
      return next(new AppError('Insufficient permissions.', 403));
    }

    next();
  };
}

module.exports = requireRole;
