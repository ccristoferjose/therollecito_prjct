class AppError extends Error {
  /**
   * @param {string} message  Safe to show to the client.
   * @param {number} statusCode
   * @param {string} [code]   Optional machine-readable code the client can branch
   *                          on (e.g. DELIVERY_QUOTE_EXPIRED). Omitted from the
   *                          response when not set, so existing errors are unchanged.
   */
  constructor(message, statusCode = 500, code) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (code) this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
