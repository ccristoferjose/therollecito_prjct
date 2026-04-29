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

async function create({ name, address, city, state, zipCode, phone }) {
  const result = await db.call('sp_location_create', [
    name, address, city, state, zipCode, phone || null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function update(locationId, { name, address, city, state, zipCode, phone }) {
  const result = await db.call('sp_location_update', [
    locationId,
    name || null,
    address || null,
    city || null,
    state || null,
    zipCode || null,
    phone !== undefined ? phone : null,
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
