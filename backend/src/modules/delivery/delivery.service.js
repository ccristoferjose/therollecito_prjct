const db = require('../../config/db');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { getIO } = require('../../sockets');
const { getProvider } = require('./providers');
const { getGeocoder } = require('./geocoding');
const { priceDelivery } = require('./delivery.pricing');
const { getSettings } = require('./delivery.settings');
const { DeliveryError } = require('./delivery.errors');
const addressUtil = require('./delivery.address');

/**
 * Delivery orchestration. The ONLY module that talks to a delivery provider;
 * orders, payments and the kitchen call in here and never see provider details.
 *
 * Flow:
 *   getQuote            -> customer sees fee + ETA (stored in delivery_quote)
 *   attachToOrder       -> order becomes DELIVERY with the accepted quote
 *   assertOrderQuoteValid / refreshOrderQuote / acceptOrderQuote
 *                       -> never take payment against an expired quote
 *   dispatchForOrder    -> after payment succeeds, create the courier delivery
 *   handleWebhook       -> courier status updates from the provider
 */

// A DISPATCHING claim older than this is assumed dead (process crashed mid-call).
const STALE_DISPATCH_MINUTES = 5;

function firstRows(result) {
  return Array.isArray(result[0]) ? result[0] : result;
}

const toIso = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const centsToDollars = (cents) => Math.round(cents) / 100;
const dollarsToCents = (dollars) => Math.round(Number(dollars) * 100);

function requireProvider() {
  const provider = getProvider();
  if (!env.delivery.enabled || !provider || !provider.isConfigured()) {
    throw new DeliveryError('NOT_CONFIGURED');
  }
  return provider;
}

function logDeliveryError(context, err) {
  // Detail holds provider codes/messages only — never tokens or credentials.
  console.error(
    `[Delivery] ${context} failed: ${err.deliveryCode || err.message}`,
    err.detail ? JSON.stringify(err.detail) : '',
  );
}

function emitDeliveryEvent(locationId, orderId, deliveryStatus) {
  const io = getIO();
  if (!io || !locationId) return;
  // Same /kitchen location rooms the order events use; the payload carries no
  // PII, only ids and the courier status.
  io.of('/kitchen').to(`location_${locationId}`).emit('delivery_updated', {
    order_id: Number(orderId),
    location_id: Number(locationId),
    delivery_status: deliveryStatus,
    timestamp: Date.now(),
  });
}

/**
 * Public: is delivery offered, and from what subtotal. The split itself is not
 * exposed — the customer only ever sees their own fee on the quote.
 */
async function getStatus() {
  const provider = getProvider();
  const settings = await getSettings();
  return {
    available: Boolean(env.delivery.enabled && provider && provider.isConfigured()),
    minOrderAmount: settings.minOrderAmount,
  };
}

const money = (n) => `$${Number(n).toFixed(2)}`;

/** Delivery requires the admin-set minimum subtotal (before discounts). */
async function assertMeetsMinimum(subtotal) {
  const { minOrderAmount } = await getSettings();
  if (minOrderAmount > 0 && dollarsToCents(subtotal || 0) < dollarsToCents(minOrderAmount)) {
    const short = (dollarsToCents(minOrderAmount) - dollarsToCents(subtotal || 0)) / 100;
    throw new DeliveryError(
      'BELOW_MINIMUM',
      { subtotal: Number(subtotal) || 0, minOrderAmount },
      `Delivery is available for orders of ${money(minOrderAmount)} or more. ` +
        `Add ${money(short)} more or choose Pickup.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Locations (pickup side)
// ---------------------------------------------------------------------------

async function getLocation(locationId, { requireActive = true } = {}) {
  const location = firstRows(await db.call('sp_location_get_for_delivery', [locationId]))[0];
  if (!location || (requireActive && !location.is_active)) {
    throw new DeliveryError('LOCATION_NOT_DELIVERABLE', { locationId, reason: 'missing_or_inactive' });
  }
  return location;
}

/**
 * The location's pickup address with coordinates. Geocoded once and stored, so
 * admins never have to type latitude/longitude.
 */
async function pickupAddressFor(location) {
  const address = addressUtil.fromLocation(location);
  if (addressUtil.hasCoordinates(address)) return address;

  const result = await getGeocoder().geocode(address);
  if (result.status !== 'matched') return address;

  try {
    await db.call('sp_location_set_coordinates', [location.id, result.latitude, result.longitude]);
  } catch (err) {
    console.warn(`[Delivery] Could not store coordinates for location ${location.id}:`, err.message);
  }
  return { ...address, latitude: result.latitude, longitude: result.longitude };
}

function pickupPhoneFor(location) {
  const phone = addressUtil.toE164(location.phone) || addressUtil.toE164(env.delivery.pickupPhoneFallback);
  if (!phone) {
    throw new DeliveryError('LOCATION_NOT_DELIVERABLE', { locationId: location.id, reason: 'no_pickup_phone' });
  }
  return phone;
}

function externalStoreId(locationId) {
  return `${env.delivery.externalStoreIdPrefix}-location-${locationId}`;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Kitchen prep estimate for an ASAP order at this location, in minutes. */
async function estimatePrepMinutes(locationId) {
  try {
    const servicePeriodService = require('../service-period/service-period.service');
    const periods = await servicePeriodService.listBookable(locationId, null);
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const nowT = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const current = periods.find((p) => p.start_time <= nowT && nowT <= p.end_time);
    const prep = Number(current?.prep_time_minutes) || 0;
    if (prep > 0) return prep;
  } catch (err) {
    console.warn('[Delivery] Could not resolve prep time, using default:', err.message);
  }
  return env.delivery.defaultPrepMinutes;
}

/**
 * When the courier should collect the food.
 *
 *   scheduled order -> the customer's chosen time. It arrives as restaurant-local
 *                      wall clock ("2026-09-26T07:45:00", or a DATETIME Date from
 *                      MySQL). Node runs in the restaurant's TZ, so the Date
 *                      constructor interprets it as local time; the provider
 *                      later receives it via toISOString() in UTC. No manual
 *                      PST/PDT offset arithmetic anywhere.
 *   ASAP            -> now + estimated prep time.
 */
async function computePickupReadyAt(locationId, pickupTime) {
  if (pickupTime) {
    const at =
      pickupTime instanceof Date
        ? pickupTime
        : new Date(String(pickupTime).trim().replace(' ', 'T').replace(/(\.\d+)?Z$/, '').slice(0, 19));
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) {
      throw new DeliveryError('INVALID_PICKUP_TIME', { pickupTime: String(pickupTime) });
    }
    return at;
  }
  const prepMinutes = await estimatePrepMinutes(locationId);
  return new Date(Date.now() + prepMinutes * 60_000);
}

function isQuoteUsable(expiresAt) {
  if (!expiresAt) return false;
  const bufferMs = env.delivery.quoteExpiryBufferSeconds * 1000;
  return new Date(expiresAt).getTime() - bufferMs > Date.now();
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

/** The shape the frontend receives. The provider's own fee is never exposed. */
function toClientQuote(row) {
  const fee = Number(row.customer_delivery_fee);
  return {
    quoteId: row.provider_quote_id || row.quote_id,
    fee,
    feeCents: dollarsToCents(fee),
    currency: row.currency,
    durationMinutes: row.duration_minutes ?? null,
    pickupDurationMinutes: row.pickup_duration_minutes ?? null,
    estimatedDeliveryAt: toIso(row.dropoff_eta),
    expiresAt: toIso(row.expires_at || row.quote_expires_at),
    pickupReadyAt: toIso(row.pickup_ready_at),
    address: {
      streetAddress: row.street_address,
      apartment: row.apartment || null,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      country: row.country || 'US',
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
    },
  };
}

/** Ask the provider for a price, apply pricing rules, persist, return the row. */
async function requestQuote({ provider, location, dropoff, pickupReadyAt, subtotal }) {
  const pickupAddress = await pickupAddressFor(location);

  if (
    env.delivery.maxRadiusMiles &&
    addressUtil.hasCoordinates(pickupAddress) &&
    addressUtil.hasCoordinates(dropoff)
  ) {
    const miles = addressUtil.distanceMiles(pickupAddress, dropoff);
    if (miles > env.delivery.maxRadiusMiles) {
      throw new DeliveryError('OUTSIDE_DELIVERY_RADIUS', { miles: Math.round(miles * 10) / 10 });
    }
  }

  const quote = await provider.getQuote({
    pickup: { address: pickupAddress, phone: pickupPhoneFor(location) },
    dropoff: { address: dropoff },
    pickupReadyAt,
    manifestTotalValue: Math.max(0, Number(subtotal) || 0),
    externalStoreId: externalStoreId(location.id),
  });
  if (!quote.expiresAt || quote.expiresAt.getTime() <= Date.now()) {
    throw new DeliveryError('PROVIDER_UNAVAILABLE', { reason: 'quote_already_expired' });
  }

  // Admin split: customer pays customerFeePercent of the provider fee; the
  // restaurant covers the rest. Locked into this quote from here on.
  const pricing = priceDelivery({ providerFeeCents: quote.feeCents, settings: await getSettings() });

  const rows = firstRows(
    await db.call('sp_delivery_quote_create', [
      provider.name,
      quote.providerQuoteId,
      location.id,
      dropoff.streetAddress,
      dropoff.apartment || null,
      dropoff.city,
      dropoff.state,
      dropoff.zipCode,
      dropoff.country || 'US',
      addressUtil.hasCoordinates(dropoff) ? dropoff.latitude : null,
      addressUtil.hasCoordinates(dropoff) ? dropoff.longitude : null,
      centsToDollars(pricing.providerFeeCents),
      centsToDollars(pricing.customerFeeCents),
      quote.currency,
      pickupReadyAt,
      quote.dropoffEta,
      quote.durationMinutes,
      quote.pickupDurationMinutes,
      quote.expiresAt,
    ]),
  );
  return rows[0];
}

/**
 * POST /api/delivery/quote. The restaurant side (address, coordinates, phone)
 * is resolved here from the location — the client only supplies the dropoff.
 */
async function getQuote({ locationId, address, pickupTime, subtotal }) {
  const provider = requireProvider();

  // Cheap checks first: never call the provider for an order that can't be delivered.
  await assertMeetsMinimum(subtotal);

  const problems = addressUtil.validate(address);
  if (problems.length) throw new DeliveryError('INVALID_ADDRESS', { problems });

  const location = await getLocation(locationId);
  const pickupReadyAt = await computePickupReadyAt(locationId, pickupTime);

  const geo = await getGeocoder().geocode(address);
  const dropoff =
    geo.status === 'matched' ? { ...address, latitude: geo.latitude, longitude: geo.longitude } : address;

  try {
    const row = await requestQuote({ provider, location, dropoff, pickupReadyAt, subtotal });
    return { ...toClientQuote(row), formattedAddress: geo.formatted || null };
  } catch (err) {
    // The geocoder could not find the address and neither could the provider:
    // that is an address problem, not a coverage problem.
    if (geo.status === 'no_match' && err.deliveryCode === 'ADDRESS_UNDELIVERABLE') {
      throw new DeliveryError('INVALID_ADDRESS', err.detail);
    }
    throw err;
  }
}

async function getStoredQuote(quoteId) {
  const provider = getProvider();
  if (!provider) return null;
  return firstRows(await db.call('sp_delivery_quote_get', [provider.name, quoteId]))[0] || null;
}

/**
 * Checked BEFORE an order row is created, so an unusable quote never leaves a
 * half-built order behind.
 */
async function assertQuoteForNewOrder({ quoteId, locationId, pickupTime }) {
  requireProvider();
  const quote = quoteId ? await getStoredQuote(quoteId) : null;
  if (!quote || Number(quote.location_id) !== Number(locationId)) {
    throw new DeliveryError('QUOTE_NOT_FOUND', { quoteId, locationId });
  }
  if (!isQuoteUsable(quote.expires_at)) throw new DeliveryError('QUOTE_EXPIRED', { quoteId });

  // A quote priced for a different pickup time is not the delivery being ordered.
  if (pickupTime) {
    const wanted = await computePickupReadyAt(locationId, pickupTime);
    if (Math.abs(wanted.getTime() - new Date(quote.pickup_ready_at).getTime()) > 60_000) {
      throw new DeliveryError('QUOTE_NOT_FOUND', { quoteId, reason: 'pickup_time_changed' });
    }
  }
  return quote;
}

/** Turn a freshly created order into a DELIVERY order. */
async function attachToOrder(orderId, { quoteId, dropoffName, dropoffPhone, dropoffNotes }) {
  const provider = requireProvider();
  const phone = addressUtil.toE164(dropoffPhone);
  if (!phone) throw new AppError('A valid phone number is required for delivery.', 400);

  try {
    const rows = firstRows(
      await db.call('sp_delivery_create_for_order', [
        orderId,
        provider.name,
        quoteId,
        dropoffName,
        phone,
        dropoffNotes ? String(dropoffNotes).slice(0, 280) : null,
      ]),
    );
    return rows[0];
  } catch (err) {
    if (/quote has expired/i.test(err.sqlMessage || '')) throw new DeliveryError('QUOTE_EXPIRED');
    if (/quote not found/i.test(err.sqlMessage || '')) throw new DeliveryError('QUOTE_NOT_FOUND');
    throw err;
  }
}

async function getOrderDelivery(orderId) {
  return firstRows(await db.call('sp_delivery_get_by_order', [orderId]))[0] || null;
}

/** Guard used right before a PaymentIntent is created. */
async function assertOrderQuoteValid(orderId) {
  const delivery = await getOrderDelivery(orderId);
  if (!delivery) throw new DeliveryError('QUOTE_NOT_FOUND', { orderId, reason: 'no_delivery_row' });
  // Authoritative minimum check: the server-calculated subtotal, not whatever
  // the browser sent when quoting.
  await assertMeetsMinimum(delivery.subtotal_amount);
  if (delivery.status === 'QUOTED' && !isQuoteUsable(delivery.quote_expires_at)) {
    throw new DeliveryError('QUOTE_EXPIRED', { orderId });
  }
  return delivery;
}

async function recalculateOrder(orderId, promotionCode) {
  const orderService = require('../order/order.service');
  const totals = await orderService.calculateTotal(orderId, promotionCode);
  return {
    subtotal_amount: totals.subtotal_amount,
    discount_amount: totals.discount_amount,
    delivery_fee: totals.delivery_fee,
    processing_fee: totals.processing_fee,
    total_amount: totals.total_amount,
  };
}

/**
 * Called before payment. Keeps a still-valid quote; otherwise re-quotes the same
 * address. An unchanged fee is applied silently. A changed fee is returned
 * WITHOUT applying it — the customer must accept it (acceptOrderQuote).
 *
 * Returns { status: 'valid' | 'renewed' | 'price_changed', quote, previousFee?, totals? }
 */
async function refreshOrderQuote(orderId) {
  const provider = requireProvider();
  const delivery = await getOrderDelivery(orderId);
  if (!delivery) throw new AppError('Order is not a delivery order.', 400);
  if (delivery.order_status !== 'CREATED' || delivery.status !== 'QUOTED') {
    throw new AppError('Order is no longer editable.', 400);
  }

  if (isQuoteUsable(delivery.quote_expires_at)) {
    return { status: 'valid', quote: toClientQuote(delivery) };
  }

  const location = await getLocation(delivery.location_id);
  const pickupReadyAt = await computePickupReadyAt(delivery.location_id, delivery.pickup_time);
  const row = await requestQuote({
    provider,
    location,
    dropoff: addressUtil.fromRow(delivery),
    pickupReadyAt,
    subtotal: delivery.subtotal_amount,
  });

  const quote = toClientQuote(row);
  const previousFee = Number(delivery.customer_delivery_fee);

  if (dollarsToCents(previousFee) === quote.feeCents) {
    const totals = await acceptOrderQuote(orderId, quote.quoteId);
    return { status: 'renewed', ...totals };
  }
  return { status: 'price_changed', previousFee, quote };
}

/** The customer accepted a new quote for an unpaid delivery order. */
async function acceptOrderQuote(orderId, quoteId) {
  const provider = requireProvider();
  const stored = await getStoredQuote(quoteId);
  if (!stored) throw new DeliveryError('QUOTE_NOT_FOUND', { quoteId });
  if (!isQuoteUsable(stored.expires_at)) throw new DeliveryError('QUOTE_EXPIRED', { quoteId });

  try {
    await db.call('sp_delivery_apply_quote', [orderId, provider.name, quoteId]);
  } catch (err) {
    if (/quote has expired/i.test(err.sqlMessage || '')) throw new DeliveryError('QUOTE_EXPIRED');
    throw err;
  }

  const delivery = await getOrderDelivery(orderId);
  const totals = await recalculateOrder(orderId, delivery.promotion_code);
  return { quote: toClientQuote(stored), totals };
}

// ---------------------------------------------------------------------------
// Dispatch (after payment)
// ---------------------------------------------------------------------------

function manifestFrom(items, itemOptions) {
  return items.map((item) => {
    const options = itemOptions.filter((o) => o.order_item_id === item.id);
    const modifiers = options.reduce((sum, o) => sum + Number(o.price_modifier || 0), 0);
    const optionLabel = options.map((o) => o.option_value_name).filter(Boolean).join(', ');
    return {
      name: optionLabel ? `${item.item_name} (${optionLabel})` : item.item_name,
      quantity: item.quantity,
      price: Number(item.unit_price) + modifiers,
    };
  });
}

/**
 * Create the courier delivery for a PAID delivery order.
 *
 * Idempotent per order: the Stripe webhook, the browser confirm call and a
 * staff retry may all land here for the same order. sp_delivery_claim_dispatch
 * lets exactly one of them proceed; the rest return { dispatched: false }. The
 * provider also receives a stable idempotency key derived from the order id, so
 * even a retry after an ambiguous timeout cannot create a second courier job.
 *
 * Never throws — failures are recorded on the delivery row (FAILED, retryable
 * from the kitchen board) so callers can fire and forget.
 */
async function dispatchForOrder(orderId) {
  let claimed = false;
  let delivery = null;
  try {
    const claim = firstRows(await db.call('sp_delivery_claim_dispatch', [orderId, STALE_DISPATCH_MINUTES]))[0];
    claimed = Number(claim?.claimed) > 0;
    if (!claimed) return { dispatched: false, reason: 'not_claimable' };

    const provider = requireProvider();
    delivery = await getOrderDelivery(orderId);
    const location = await getLocation(delivery.location_id, { requireActive: false });
    const pickupAddress = await pickupAddressFor(location);

    const orderService = require('../order/order.service');
    const { items, itemOptions } = await orderService.getItems(orderId);

    // ASAP: the quote-time estimate may have slipped while the customer paid.
    const minReady = Date.now() + 2 * 60_000;
    const quotedReady = new Date(delivery.pickup_ready_at).getTime();
    const pickupReadyAt = new Date(Math.max(quotedReady, delivery.pickup_time ? 0 : minReady));

    const orderRef = `#${String(delivery.display_number || orderId).padStart(3, '0')}`;
    const request = {
      pickup: { name: location.name, phone: pickupPhoneFor(location), address: pickupAddress },
      dropoff: {
        name: delivery.dropoff_name,
        phone: delivery.dropoff_phone,
        address: addressUtil.fromRow(delivery),
      },
      pickupReadyAt,
      manifestTotalValue: delivery.subtotal_amount,
      manifestItems: manifestFrom(items, itemOptions),
      manifestReference: orderRef,
      externalStoreId: externalStoreId(delivery.location_id),
      externalId: `${env.delivery.externalStoreIdPrefix}-order-${orderId}`,
      idempotencyKey: `${env.delivery.externalStoreIdPrefix}-order-${orderId}`,
      pickupNotes: `Rollecito order ${orderRef} for ${delivery.dropoff_name}`,
      dropoffNotes: delivery.dropoff_notes || null,
    };

    let result;
    try {
      result = await provider.createDelivery({ ...request, quoteId: delivery.quote_id });
    } catch (err) {
      if (err.deliveryCode !== 'QUOTE_EXPIRED') throw err;
      // The quote lapsed between payment and dispatch. The customer already paid
      // the accepted fee, so dispatch without the quote; the provider re-prices
      // and any difference is absorbed by the merchant (recorded as provider_fee).
      console.warn(`[Delivery] Quote expired at dispatch for order ${orderId}; dispatching without quote.`);
      result = await provider.createDelivery({ ...request, idempotencyKey: `${request.idempotencyKey}-requote` });
    }

    await db.call('sp_delivery_mark_dispatched', [
      orderId,
      result.providerDeliveryId,
      result.status,
      result.feeCents != null ? centsToDollars(result.feeCents) : null,
      result.trackingUrl,
      result.pickupEta,
      result.dropoffEta,
    ]);
    emitDeliveryEvent(delivery.location_id, orderId, result.status);
    return { dispatched: true, status: result.status };
  } catch (err) {
    logDeliveryError(`dispatch for order ${orderId}`, err);
    if (claimed) {
      const code = err.deliveryCode || 'DELIVERY_CREATE_FAILED';
      try {
        await db.call('sp_delivery_mark_failed', [orderId, code]);
        emitDeliveryEvent(delivery?.location_id, orderId, 'FAILED');
      } catch (markErr) {
        console.error(`[Delivery] Could not mark order ${orderId} as FAILED:`, markErr.message);
      }
    }
    return { dispatched: false, reason: err.deliveryCode || 'DELIVERY_CREATE_FAILED' };
  }
}

/** Fire-and-forget wrapper for the payment paths — never delays the response. */
function dispatchInBackground(orderId) {
  setImmediate(() => {
    dispatchForOrder(orderId).catch((err) => logDeliveryError(`dispatch for order ${orderId}`, err));
  });
}

/** Staff "Retry courier" from the kitchen board. */
async function retryDispatch(orderId) {
  const delivery = await getOrderDelivery(orderId);
  if (!delivery) throw new AppError('Order is not a delivery order.', 404);
  if (delivery.status !== 'FAILED' && delivery.status !== 'QUOTED') {
    throw new AppError('A courier has already been requested for this order.', 409);
  }
  const result = await dispatchForOrder(orderId);
  if (!result.dispatched) {
    throw new DeliveryError(result.reason === 'not_claimable' ? 'DELIVERY_CREATE_FAILED' : result.reason);
  }
  return result;
}

/**
 * Best-effort courier cancellation when staff cancel a delivery order. The
 * refund has already been issued by the order flow; a provider failure here is
 * logged, not surfaced, so it can never block the cancellation itself.
 */
async function cancelForOrder(orderId) {
  const delivery = await getOrderDelivery(orderId);
  if (!delivery) return null;

  const terminal = ['DELIVERED', 'CANCELED', 'RETURNED'];
  if (delivery.provider_delivery_id && !terminal.includes(delivery.status)) {
    const provider = getProvider(delivery.provider);
    try {
      if (provider && provider.isConfigured()) await provider.cancelDelivery(delivery.provider_delivery_id);
    } catch (err) {
      logDeliveryError(`cancel for order ${orderId}`, err);
    }
  }
  const rows = firstRows(await db.call('sp_delivery_cancel', [orderId]));
  emitDeliveryEvent(delivery.location_id, orderId, rows[0]?.status || 'CANCELED');
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Verify -> find delivery -> update status / ETA / tracking / courier -> notify
 * clients. Handles both event.delivery_status and event.courier_update.
 * The signature is checked against the RAW body before anything is parsed or
 * written.
 */
async function handleWebhook(rawBody, headers, providerName) {
  const provider = getProvider(providerName);
  if (!provider || !provider.verifyWebhook(rawBody, headers)) {
    console.warn(`[Delivery] Rejected ${providerName} webhook: signature verification failed.`);
    throw new DeliveryError('WEBHOOK_VERIFICATION_FAILED');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError('Invalid JSON payload.', 400);
  }

  const update = provider.parseWebhook(payload);
  if (!update) return { received: true, ignored: true };

  const { courier } = update;
  const row = firstRows(
    await db.call('sp_delivery_apply_provider_update', [
      provider.name,
      update.providerDeliveryId,
      update.orderId,
      update.status,
      update.trackingUrl,
      update.pickupEta,
      update.dropoffEta,
      courier.mode,
      courier.mode === 'SET' ? courier.name : null,
      courier.mode === 'SET' ? courier.imageUrl : null,
      courier.mode === 'SET' ? courier.vehicle : null,
      courier.mode === 'SET' ? courier.vehicleType : null,
      courier.mode === 'SET' ? courier.licensePlate : null,
      courier.mode === 'SET' ? courier.rating : null,
      update.courierImminent === null ? null : update.courierImminent ? 1 : 0,
      update.undeliverableReason,
      update.providerUpdatedAt,
    ]),
  )[0];

  if (!row) {
    // Unknown delivery (another environment sharing the webhook, or a test
    // event). Acknowledge so the provider does not retry forever.
    console.warn(`[Delivery] Webhook for unknown delivery ${update.providerDeliveryId}; ignored.`);
    return { received: true, ignored: true };
  }

  // Courier location pings arrive every few seconds; only push to the tracking
  // page and the kitchen when something they display actually changed.
  if (Number(row.notify)) emitDeliveryEvent(row.location_id, row.order_id, row.status);
  return { received: true };
}

module.exports = {
  getStatus,
  getQuote,
  assertQuoteForNewOrder,
  attachToOrder,
  getOrderDelivery,
  assertOrderQuoteValid,
  refreshOrderQuote,
  acceptOrderQuote,
  dispatchForOrder,
  dispatchInBackground,
  retryDispatch,
  cancelForOrder,
  handleWebhook,
  // Exposed for tests.
  _internal: { computePickupReadyAt, isQuoteUsable, toClientQuote, manifestFrom },
};
