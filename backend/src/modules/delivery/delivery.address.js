/**
 * Address + phone normalization shared by the delivery service and providers.
 *
 * The canonical in-app address shape (provider-neutral):
 *   { streetAddress, apartment?, city, state, zipCode, country: 'US', latitude?, longitude? }
 */

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const ZIP_RE = /^\d{5}(-\d{4})?$/;

const clean = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

/** Build the canonical address from the request body (snake_case on the wire). */
function fromRequest(body = {}) {
  return {
    streetAddress: clean(body.street_address),
    apartment: clean(body.apartment) || null,
    city: clean(body.city),
    state: clean(body.state).toUpperCase(),
    zipCode: clean(body.zip_code),
    country: 'US',
  };
}

/** Build the canonical address from a delivery / delivery_quote row. */
function fromRow(row) {
  return {
    streetAddress: row.street_address,
    apartment: row.apartment || null,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    country: row.country || 'US',
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
  };
}

/** Parse a location row (single-line `address` column) into the canonical shape. */
function fromLocation(location) {
  return {
    streetAddress: clean(location.address),
    apartment: null,
    city: clean(location.city),
    state: clean(location.state).toUpperCase(),
    zipCode: clean(location.zip_code),
    country: 'US',
    latitude: location.latitude != null ? Number(location.latitude) : null,
    longitude: location.longitude != null ? Number(location.longitude) : null,
  };
}

/** Returns a list of human-readable problems; empty means valid. */
function validate(address) {
  const errors = [];
  if (address.streetAddress.length < 3) errors.push('Street address is required.');
  if (address.streetAddress.length > 255) errors.push('Street address is too long.');
  if (address.apartment && address.apartment.length > 100) errors.push('Apartment / unit is too long.');
  if (address.city.length < 2) errors.push('City is required.');
  if (!US_STATES.includes(address.state)) errors.push('State must be a valid US state.');
  if (!ZIP_RE.test(address.zipCode)) errors.push('ZIP code must be 5 digits.');
  return errors;
}

/**
 * US phone -> E.164 (+15555555555). Couriers call this number, so anything
 * that does not resolve to a real-looking number is rejected (null).
 */
function toE164(phone) {
  if (!phone) return null;
  const raw = String(phone).trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** Great-circle distance in miles. */
function distanceMiles(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function hasCoordinates(address) {
  return Number.isFinite(address?.latitude) && Number.isFinite(address?.longitude);
}

module.exports = {
  US_STATES,
  ZIP_RE,
  fromRequest,
  fromRow,
  fromLocation,
  validate,
  toE164,
  distanceMiles,
  hasCoordinates,
};
