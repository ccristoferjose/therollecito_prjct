const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Checks express-validator results and throws 400 if invalid.
 * Place after validation chains in route definitions.
 */
function validateRequest(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    return next(new AppError(messages.join('; '), 400));
  }
  next();
}

module.exports = validateRequest;
