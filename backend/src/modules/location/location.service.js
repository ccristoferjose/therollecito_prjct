const db = require('../../config/db');

async function listActive() {
  const result = await db.call('sp_location_list_active', []);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows;
}

async function listAll() {
  const result = await db.call('sp_location_list_all', []);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows;
}

// Accept HH:MM or HH:MM:SS; return HH:MM:SS for MySQL TIME, or null.
function normalizeTime(t) {
  if (t === null || t === undefined || t === '') return null;
  const s = String(t).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  const err = new Error('Invalid time format. Use HH:MM (24-hour).');
  err.statusCode = 400;
  throw err;
}

async function create({ name, address, city, state, zipCode, phone, openTime, closeTime }) {
  const result = await db.call('sp_location_create', [
    name,
    address,
    city,
    state,
    zipCode,
    phone || null,
    normalizeTime(openTime),
    normalizeTime(closeTime),
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function update(locationId, { name, address, city, state, zipCode, phone, openTime, closeTime, clearHours }) {
  const result = await db.call('sp_location_update', [
    locationId,
    name || null,
    address || null,
    city || null,
    state || null,
    zipCode || null,
    phone !== undefined ? phone : null,
    normalizeTime(openTime),
    normalizeTime(closeTime),
    clearHours ? 1 : 0,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function toggleActive(locationId, isActive) {
  const result = await db.call('sp_location_toggle_active', [locationId, isActive ? 1 : 0]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

module.exports = { listActive, listAll, create, update, toggleActive };
