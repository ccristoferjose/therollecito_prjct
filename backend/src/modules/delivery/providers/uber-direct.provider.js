const crypto = require('crypto');
const env = require('../../../config/env');
const { DeliveryError } = require('../delivery.errors');

/**
 * Uber Direct (DaaS) provider.
 *
 * Implements the provider contract used by delivery.service:
 *   isConfigured()                       -> boolean
 *   getQuote(request)                    -> NormalizedQuote
 *   createDelivery(request)              -> NormalizedDelivery
 *   cancelDelivery(providerDeliveryId)   -> void
 *   verifyWebhook(rawBody, headers)      -> boolean
 *   parseWebhook(payload)                -> NormalizedDeliveryUpdate | null
 *
 * Everything Uber-specific — the OAuth flow, cents, the JSON-in-a-string
 * address format, status names, error codes — stays inside this file.
 * Credentials are read server-side only and are never logged.
 */

const NAME = 'uber_direct';
const REQUEST_TIMEOUT_MS = 10_000;
// Refresh the token this long before Uber says it expires.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

function isConfigured() {
  const { clientId, clientSecret, customerId } = env.uber;
  return Boolean(clientId && clientSecret && customerId);
}

// ---------------------------------------------------------------------------
// OAuth (client credentials) with an in-memory cached token.
//
// Uber issues long-lived tokens (expires_in is ~30 days), so re-authenticating
// per quote would be pure waste and risks their auth rate limits. Concurrent
// callers share one in-flight refresh instead of stampeding the token endpoint.
// ---------------------------------------------------------------------------
const tokenCache = { accessToken: null, expiresAt: 0, inflight: null };

async function fetchAccessToken() {
  const body = new URLSearchParams({
    client_id: env.uber.clientId,
    client_secret: env.uber.clientSecret,
    grant_type: 'client_credentials',
    scope: env.uber.scope,
  });

  let res;
  try {
    res = await fetch(env.uber.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new DeliveryError('PROVIDER_UNAVAILABLE', { stage: 'oauth', reason: err.name });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // Never include the response body verbatim: it can echo the client id.
    throw new DeliveryError('PROVIDER_AUTH_FAILED', { stage: 'oauth', status: res.status, error: data.error });
  }

  const ttlMs = (Number(data.expires_in) || 3600) * 1000;
  tokenCache.accessToken = data.access_token;
  tokenCache.expiresAt = Date.now() + ttlMs;
  return tokenCache.accessToken;
}

async function getAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && tokenCache.accessToken && Date.now() < tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.accessToken;
  }
  if (!tokenCache.inflight) {
    tokenCache.inflight = fetchAccessToken().finally(() => {
      tokenCache.inflight = null;
    });
  }
  return tokenCache.inflight;
}

function invalidateToken() {
  tokenCache.accessToken = null;
  tokenCache.expiresAt = 0;
}

// ---------------------------------------------------------------------------
// Error mapping: Uber code/message -> normalized DeliveryError code.
// ---------------------------------------------------------------------------
function mapUberError(httpStatus, body, stage) {
  const code = String(body?.code || '').toLowerCase();
  const message = String(body?.message || '');
  const detail = { stage, status: httpStatus, code, message };

  if (httpStatus === 401 || httpStatus === 403) return new DeliveryError('PROVIDER_AUTH_FAILED', detail);
  if (code === 'address_undeliverable_limited_couriers' || code === 'couriers_busy') {
    return new DeliveryError('NO_COURIERS', detail);
  }
  if (code === 'address_undeliverable' || code === 'unknown_location' || code === 'address_not_serviceable') {
    return new DeliveryError('ADDRESS_UNDELIVERABLE', detail);
  }
  if (code.includes('quote') || /quote.*expired|expired.*quote/i.test(message)) {
    return new DeliveryError('QUOTE_EXPIRED', detail);
  }
  if (/^(pickup|dropoff)_(ready|deadline|window)/.test(code) || /pickup_ready_dt|pickup time/i.test(message)) {
    return new DeliveryError('INVALID_PICKUP_TIME', detail);
  }
  if (code === 'invalid_params' && /address/i.test(message)) {
    return new DeliveryError('INVALID_ADDRESS', detail);
  }
  if (httpStatus === 429 || httpStatus >= 500 || ['service_unavailable', 'request_timeout', 'unknown_error'].includes(code)) {
    return new DeliveryError('PROVIDER_UNAVAILABLE', detail);
  }
  return new DeliveryError(stage === 'create_delivery' ? 'DELIVERY_CREATE_FAILED' : 'ADDRESS_UNDELIVERABLE', detail);
}

async function uberRequest(path, { method = 'GET', body, stage }) {
  const url = `${env.uber.apiBaseUrl}/v1/customers/${encodeURIComponent(env.uber.customerId)}${path}`;

  // One retry on 401: a cached token revoked/rotated on Uber's side.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getAccessToken({ forceRefresh: attempt > 0 });
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new DeliveryError('PROVIDER_UNAVAILABLE', { stage, reason: err.name });
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if (res.status === 401 && attempt === 0) {
      invalidateToken();
      continue;
    }
    throw mapUberError(res.status, data, stage);
  }
  throw new DeliveryError('PROVIDER_AUTH_FAILED', { stage });
}

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

/**
 * Uber's structured address is a JSON object serialized INTO a string:
 *   "{\"street_address\":[\"620 E El Segundo Blvd\"],\"city\":\"Los Angeles\",...}"
 * The apartment/unit goes on as a second street_address line.
 */
function toUberAddress(address) {
  return JSON.stringify({
    street_address: [address.streetAddress, address.apartment].filter(Boolean),
    city: address.city,
    state: address.state,
    zip_code: address.zipCode,
    country: address.country || 'US',
  });
}

const toCents = (dollars) => Math.round(Number(dollars) * 100);

function coordinates(prefix, address) {
  if (!Number.isFinite(address?.latitude) || !Number.isFinite(address?.longitude)) return {};
  return { [`${prefix}_latitude`]: address.latitude, [`${prefix}_longitude`]: address.longitude };
}

function baseRequest(req) {
  return {
    pickup_address: toUberAddress(req.pickup.address),
    dropoff_address: toUberAddress(req.dropoff.address),
    ...coordinates('pickup', req.pickup.address),
    ...coordinates('dropoff', req.dropoff.address),
    // Always an absolute UTC instant; never hand-built offsets.
    pickup_ready_dt: req.pickupReadyAt.toISOString(),
    ...(req.pickup.phone ? { pickup_phone_number: req.pickup.phone } : {}),
    ...(req.dropoff.phone ? { dropoff_phone_number: req.dropoff.phone } : {}),
    manifest_total_value: toCents(req.manifestTotalValue),
    external_store_id: req.externalStoreId,
  };
}

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Uber status -> our delivery.status. `pending` with a courier means assigned. */
function mapStatus(uberStatus, courier) {
  switch (String(uberStatus || '').toLowerCase()) {
    case 'pending': return courier ? 'COURIER_ASSIGNED' : 'PENDING';
    case 'pickup': return 'PICKUP';
    case 'pickup_complete': return 'PICKUP_COMPLETE';
    case 'dropoff': return 'DROPOFF';
    case 'delivered': return 'DELIVERED';
    case 'canceled': return 'CANCELED';
    case 'returned': return 'RETURNED';
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/**
 * @param {object} req
 * @param {{address, phone?, name?}} req.pickup
 * @param {{address, phone?, name?}} req.dropoff
 * @param {Date} req.pickupReadyAt
 * @param {number} req.manifestTotalValue dollars
 * @param {string} req.externalStoreId
 */
async function getQuote(req) {
  const data = await uberRequest('/delivery_quotes', {
    method: 'POST',
    body: baseRequest(req),
    stage: 'quote',
  });

  if (!data.id || !Number.isFinite(Number(data.fee)) || !data.expires) {
    throw new DeliveryError('PROVIDER_UNAVAILABLE', { stage: 'quote', reason: 'malformed_response' });
  }

  return {
    providerQuoteId: data.id,
    feeCents: Number(data.fee),
    currency: String(data.currency || 'usd').toUpperCase(),
    durationMinutes: Number.isFinite(Number(data.duration)) ? Number(data.duration) : null,
    pickupDurationMinutes: Number.isFinite(Number(data.pickup_duration)) ? Number(data.pickup_duration) : null,
    dropoffEta: parseDate(data.dropoff_eta),
    expiresAt: parseDate(data.expires),
  };
}

/**
 * @param {object} req  baseRequest fields plus:
 *   quoteId?, externalId, idempotencyKey, manifestItems [{name, quantity, price}],
 *   manifestReference, pickup.name, dropoff.name, dropoffNotes?, pickupNotes?
 */
async function createDelivery(req) {
  const body = {
    ...baseRequest(req),
    pickup_name: req.pickup.name,
    dropoff_name: req.dropoff.name,
    ...(req.quoteId ? { quote_id: req.quoteId } : {}),
    external_id: req.externalId,
    // Uber-side dedupe on top of our own row-level claim.
    idempotency_key: req.idempotencyKey,
    manifest_reference: req.manifestReference,
    manifest_items: req.manifestItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      size: 'small',
      price: toCents(item.price),
    })),
    ...(req.pickupNotes ? { pickup_notes: req.pickupNotes } : {}),
    ...(req.dropoffNotes ? { dropoff_notes: req.dropoffNotes } : {}),
  };

  const data = await uberRequest('/deliveries', { method: 'POST', body, stage: 'create_delivery' });
  if (!data.id) {
    throw new DeliveryError('DELIVERY_CREATE_FAILED', { stage: 'create_delivery', reason: 'malformed_response' });
  }

  return {
    providerDeliveryId: data.id,
    status: mapStatus(data.status, data.courier) || 'PENDING',
    feeCents: Number.isFinite(Number(data.fee)) ? Number(data.fee) : null,
    trackingUrl: safeHttpsUrl(data.tracking_url),
    pickupEta: parseDate(data.pickup_eta),
    dropoffEta: parseDate(data.dropoff_eta),
  };
}

async function cancelDelivery(providerDeliveryId) {
  await uberRequest(`/deliveries/${encodeURIComponent(providerDeliveryId)}/cancel`, {
    method: 'POST',
    body: {},
    stage: 'cancel_delivery',
  });
}

/**
 * HMAC-SHA256 of the RAW request body with the webhook signing key, hex.
 * Uber sends it as x-uber-signature (x-postmates-signature on older webhooks).
 * Fails closed when no signing key is configured.
 */
function verifyWebhook(rawBody, headers) {
  const key = env.uber.webhookSigningKey;
  const signature = headers['x-uber-signature'] || headers['x-postmates-signature'];
  if (!key || !signature || !Buffer.isBuffer(rawBody)) return false;

  const expected = crypto.createHmac('sha256', key).update(rawBody).digest('hex');
  const a = Buffer.from(String(signature).trim().toLowerCase(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Webhook kinds that describe a delivery. Both carry the full delivery object
// in `data`; courier_update fires much more often (location pings) and is the
// one that brings courier details and courier_imminent.
const DELIVERY_EVENT_KINDS = new Set(['event.delivery_status', 'event.courier_update']);

/**
 * Only absolute https URLs from the provider are kept. They are rendered as a
 * link / image, so anything else (javascript:, data:, relative) is dropped.
 * The URL itself is never rewritten — Uber asks that tracking_url be used
 * exactly as returned.
 */
const safeHttpsUrl = (v) => (typeof v === 'string' && /^https:\/\/[^\s]+$/i.test(v) ? v : null);

const clip = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Courier snapshot. Deliberately omits the courier's phone number and live
 * location: contacting the courier and the live map stay on tracking_url.
 * Returns { mode: 'SET', ... } | { mode: 'CLEAR' } | { mode: null } (unknown).
 */
function parseCourier(data) {
  if (!('courier' in data)) return { mode: null };
  const c = data.courier;
  if (!c || typeof c !== 'object') return { mode: 'CLEAR' };
  const rating = Number.parseFloat(c.rating);
  return {
    mode: 'SET',
    name: clip(c.name, 100),
    imageUrl: safeHttpsUrl(c.img_href),
    vehicle: clip([c.vehicle_color, c.vehicle_make, c.vehicle_model].filter(Boolean).join(' '), 150),
    vehicleType: clip(c.vehicle_type, 30),
    licensePlate: clip(c.vehicle_license_plate, 20),
    rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
  };
}

/** Normalize a delivery webhook. Unrelated event kinds are ignored (null). */
function parseWebhook(payload) {
  if (!payload || !DELIVERY_EVENT_KINDS.has(payload.kind)) return null;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const providerDeliveryId = payload.delivery_id || data.id;
  if (!providerDeliveryId) return null;

  const externalMatch = /-order-(\d+)$/.exec(String(data.external_id || ''));
  return {
    kind: payload.kind,
    providerDeliveryId,
    orderId: externalMatch ? Number(externalMatch[1]) : null,
    // May be null (e.g. a courier_update without a status): ETAs and courier
    // details still apply, the status simply does not move.
    status: mapStatus(payload.status || data.status, data.courier),
    trackingUrl: safeHttpsUrl(data.tracking_url),
    pickupEta: parseDate(data.pickup_eta),
    dropoffEta: parseDate(data.dropoff_eta),
    courier: parseCourier(data),
    courierImminent: typeof data.courier_imminent === 'boolean' ? data.courier_imminent : null,
    undeliverableReason: clip(data.undeliverable_reason, 100),
    // The provider's own "last changed" time orders out-of-order events.
    providerUpdatedAt: parseDate(data.updated) || parseDate(payload.created),
  };
}

module.exports = {
  name: NAME,
  isConfigured,
  getQuote,
  createDelivery,
  cancelDelivery,
  verifyWebhook,
  parseWebhook,
  // Exposed for tests.
  _internal: { toUberAddress, mapStatus, mapUberError, getAccessToken, invalidateToken, parseCourier },
};
