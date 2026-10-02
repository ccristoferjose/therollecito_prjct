const db = require('../../config/db');

/**
 * Admin-managed delivery pricing (one global row, migration 010):
 *   minOrderAmount      delivery is offered only at or above this subtotal
 *   customerFeePercent  customer's share of the provider fee; restaurant pays the rest
 *
 * Read on every quote, so it is cached briefly. An admin save clears the cache
 * on this instance immediately; other instances pick it up within the TTL.
 */
const CACHE_TTL_MS = 15_000;
let cache = { value: null, at: 0 };

function firstRows(result) {
  return Array.isArray(result[0]) ? result[0] : result;
}

function normalize(row) {
  return {
    minOrderAmount: Number(row?.min_order_amount ?? 0),
    customerFeePercent: Number(row?.customer_fee_percent ?? 100),
    restaurantFeePercent: Number(row?.restaurant_fee_percent ?? 0),
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedByName: row?.updated_by_name || null,
  };
}

async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const row = firstRows(await db.call('sp_delivery_settings_get', []))[0];
  cache = { value: normalize(row), at: Date.now() };
  return cache.value;
}

async function updateSettings({ minOrderAmount, customerFeePercent }, userId) {
  const row = firstRows(
    await db.call('sp_delivery_settings_update', [
      Math.round(Number(minOrderAmount) * 100) / 100,
      Math.round(Number(customerFeePercent) * 100) / 100,
      userId || null,
    ]),
  )[0];
  cache = { value: normalize(row), at: Date.now() };
  return cache.value;
}

module.exports = { getSettings, updateSettings };
