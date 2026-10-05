const db = require('../../config/db');

/**
 * Admin-managed delivery pricing (one global row, migrations 010 + 011):
 *   minOrderAmount        delivery is offered only at or above this subtotal
 *   feeSplitMode          'PERCENT' or 'FLAT'
 *   customerFeePercent    PERCENT: customer's share of the provider fee
 *   restaurantFlatAmount  FLAT: dollars of the fee the restaurant covers
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
    feeSplitMode: row?.fee_split_mode === 'FLAT' ? 'FLAT' : 'PERCENT',
    restaurantFlatAmount: Number(row?.restaurant_flat_amount ?? 0),
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

async function updateSettings(
  { minOrderAmount, customerFeePercent, feeSplitMode, restaurantFlatAmount },
  userId,
) {
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const row = firstRows(
    await db.call('sp_delivery_settings_update', [
      round2(minOrderAmount),
      round2(customerFeePercent),
      feeSplitMode,
      round2(restaurantFlatAmount),
      userId || null,
    ]),
  )[0];
  cache = { value: normalize(row), at: Date.now() };
  return cache.value;
}

module.exports = { getSettings, updateSettings };
