const db = require('../../config/db');

/**
 * Pickup times cross the wire as restaurant-LOCAL wall clock, no offset:
 * "2026-09-12T15:30:00" (see buildLocalDateTime in the checkout page). The
 * backend, MySQL and the location all run the same TZ, so the string is used
 * as-is — only the separator is normalised. A value carrying an explicit
 * offset or trailing Z is NOT converted, because silently reinterpreting UTC
 * as local would shift every pickup by the offset; callers must send local.
 */
function toMysqlDateTime(value) {
  if (!value) return null;
  return String(value).trim().replace('T', ' ').replace(/(\.\d+)?Z$/, '').slice(0, 19);
}

function firstRows(result) {
  return Array.isArray(result[0]) ? result[0] : result;
}

/**
 * Render a DATETIME as restaurant-LOCAL wall clock, matching the format the
 * client sends ("2026-09-14T07:00:00").
 *
 * mysql2 turns DATETIME columns into JS Date objects, and res.json() then emits
 * them as UTC instants ("2026-09-14T13:00:00.000Z"). A browser formatting that
 * renders it in the VIEWER's timezone, so a 07:00 breakfast showed as 13:00 to a
 * naive parser and as 06:00 to a viewer one zone west. Neither is right: service
 * hours belong to the restaurant, not the customer. Emitting wall clock keeps
 * these fields consistent with start_time/end_time (TIME columns, already
 * strings) and removes the viewer's timezone from the equation entirely.
 *
 * Node runs in the restaurant's TZ (the TZ env var on the backend service), so
 * the local getters below are the restaurant's clock.
 */
function toWallClock(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
}

/** Normalise every DATETIME field a service-period row can carry. */
function normalizeRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const key of ['earliest_pickup', 'latest_pickup']) {
    if (key in out) out[key] = toWallClock(out[key]);
  }
  return out;
}

/**
 * The service period that applies to a pickup time — the single source of
 * truth for which menu the customer sees. Returns null when nothing is
 * bookable then (closed that weekday, outside every window, or too soon given
 * the period's prep time).
 */
async function resolve(locationId, pickupTime) {
  const result = await db.call('sp_service_period_resolve', [
    locationId,
    toMysqlDateTime(pickupTime),
  ]);
  const rows = firstRows(result);
  return rows[0] ? normalizeRow(rows[0]) : null;
}

/** Every period still bookable on a date, with its earliest valid pickup. */
async function listBookable(locationId, date) {
  const result = await db.call('sp_service_period_list_bookable', [
    locationId,
    date || null,
  ]);
  return firstRows(result).map(normalizeRow);
}

/**
 * Re-check a cart against a pickup time. Returns the items that are NOT
 * available then, so the UI can flag them in place. Items are never removed
 * here — that is the customer's decision.
 */
async function validateCart(locationId, pickupTime, itemIds) {
  const ids = (Array.isArray(itemIds) ? itemIds : [])
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  // Nothing to check — skip the round trip, and avoid asking the procedure to
  // resolve a period for an empty cart (which would throw when closed).
  if (ids.length === 0) return { unavailable: [] };

  const result = await db.call('sp_cart_validate_for_pickup', [
    locationId,
    toMysqlDateTime(pickupTime),
    ids.join(','),
  ]);
  return { unavailable: firstRows(result) };
}

/** Admin: all periods at a location, plus their per-weekday schedules. */
async function listByLocation(locationId) {
  const resultSets = await db.callMulti('sp_service_period_list_by_location', [
    locationId,
  ]);
  return {
    periods: resultSets[0] || [],
    schedules: resultSets[1] || [],
  };
}

async function create({ locationId, menuId, name, prepTimeMinutes, sortOrder }) {
  const result = await db.call('sp_service_period_create', [
    locationId,
    menuId,
    name,
    prepTimeMinutes !== undefined ? prepTimeMinutes : 0,
    sortOrder !== undefined ? sortOrder : 0,
  ]);
  return firstRows(result)[0];
}

async function update(id, { menuId, name, prepTimeMinutes, sortOrder, isActive }) {
  await db.call('sp_service_period_update', [
    id,
    menuId !== undefined ? menuId : null,
    name !== undefined ? name : null,
    prepTimeMinutes !== undefined ? prepTimeMinutes : null,
    sortOrder !== undefined ? sortOrder : null,
    isActive !== undefined ? isActive : null,
  ]);
}

/**
 * Upsert one weekday's hours. The procedure rejects overlapping windows at the
 * same location so menu resolution can never be ambiguous.
 */
async function setSchedule(id, { dayOfWeek, startTime, endTime }) {
  await db.call('sp_service_period_schedule_set', [
    id,
    dayOfWeek,
    startTime,
    endTime,
  ]);
}

/** Clearing a weekday is how a period is marked closed on that day. */
async function clearSchedule(id, dayOfWeek) {
  await db.call('sp_service_period_schedule_clear', [id, dayOfWeek]);
}

/**
 * Deletes only when no order references the period; otherwise deactivates, so
 * historical orders keep resolving. Returns 'deleted' | 'deactivated'.
 */
async function remove(id) {
  const result = await db.call('sp_service_period_delete', [id]);
  const rows = firstRows(result);
  return rows[0] ? rows[0].result : null;
}

module.exports = {
  toMysqlDateTime,
  toWallClock,
  resolve,
  listBookable,
  validateCart,
  listByLocation,
  create,
  update,
  setSchedule,
  clearSchedule,
  remove,
};
