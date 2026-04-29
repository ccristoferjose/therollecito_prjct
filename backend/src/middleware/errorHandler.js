const env = require('../config/env');

/**
 * Central error handler.
 * Maps DB SIGNAL errors (SQLSTATE 45000) to 400 Bad Request.
 * Maps operational AppErrors to their statusCode.
 * Everything else → 500.
 */
function errorHandler(err, _req, res, _next) {
  // DB stored procedure errors: SIGNAL SQLSTATE '45000'
  if (err.sqlState === '45000' || err.errno === 1644) {
    return res.status(400).json({
      error: err.sqlMessage || err.message,
    });
  }

  // DB connection / query errors
  if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_SP_DOES_NOT_EXIST') {
    console.error('[DB Error]', err.message);
    return res.status(500).json({
      error: 'Database configuration error.',
    });
  }

  // Operational errors from AppError
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Unknown errors
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: env.nodeEnv === 'development' ? err.message : 'Internal server error.',
  });
}

module.exports = errorHandler;
