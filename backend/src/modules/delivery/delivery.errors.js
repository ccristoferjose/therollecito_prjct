const AppError = require('../../utils/AppError');

/**
 * Normalized delivery failure codes. Providers map their own errors onto these,
 * so the rest of the app (and the frontend) never sees provider-specific codes.
 *
 * `message` is the ONLY text a customer ever sees. Raw provider errors, tokens
 * and stack traces stay in the server log (see `detail`).
 */
const CODES = {
  NOT_CONFIGURED: {
    status: 503,
    message: 'Delivery is temporarily unavailable. Please choose Pickup or try again later.',
  },
  PROVIDER_UNAVAILABLE: {
    status: 503,
    message: 'Delivery is temporarily unavailable. Please choose Pickup or try again later.',
  },
  PROVIDER_AUTH_FAILED: {
    status: 503,
    message: 'Delivery is temporarily unavailable. Please choose Pickup or try again later.',
  },
  LOCATION_NOT_DELIVERABLE: {
    status: 422,
    message: 'This location is not offering delivery right now. Please choose Pickup.',
  },
  INVALID_ADDRESS: {
    status: 422,
    message: "We couldn't find that address. Please check it and try again.",
  },
  ADDRESS_UNDELIVERABLE: {
    status: 422,
    message: 'Delivery is currently unavailable for this address. Try another address or choose Pickup.',
  },
  OUTSIDE_DELIVERY_RADIUS: {
    status: 422,
    message: 'This address is outside our delivery area. Try another address or choose Pickup.',
  },
  NO_COURIERS: {
    status: 422,
    message: 'No couriers are available right now. Try again in a few minutes or choose Pickup.',
  },
  INVALID_PICKUP_TIME: {
    status: 422,
    message: "Delivery isn't available for the selected time. Choose another time or Pickup.",
  },
  BELOW_MINIMUM: {
    status: 422,
    message: 'Your order does not meet the minimum for delivery. Add more items or choose Pickup.',
  },
  QUOTE_EXPIRED: {
    status: 409,
    message: 'Your delivery price has expired. Please review the updated price.',
  },
  QUOTE_NOT_FOUND: {
    status: 400,
    message: 'Your delivery price is no longer valid. Please check delivery availability again.',
  },
  DELIVERY_CREATE_FAILED: {
    status: 502,
    message: 'We could not request a courier. Our team has been notified.',
  },
  WEBHOOK_VERIFICATION_FAILED: {
    status: 401,
    message: 'Invalid signature.',
  },
};

class DeliveryError extends AppError {
  /**
   * @param {keyof CODES} code
   * @param {object} [detail] Internal diagnostics — logged, never sent to the client.
   * @param {string} [message] Customer-safe override (e.g. with an amount filled in).
   */
  constructor(code, detail, message) {
    const spec = CODES[code] || CODES.PROVIDER_UNAVAILABLE;
    super(message || spec.message, spec.status, `DELIVERY_${code in CODES ? code : 'PROVIDER_UNAVAILABLE'}`);
    this.deliveryCode = code in CODES ? code : 'PROVIDER_UNAVAILABLE';
    this.detail = detail;
  }
}

module.exports = { DeliveryError, CODES };
