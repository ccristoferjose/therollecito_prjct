const bcrypt = require('bcryptjs');
const db = require('../../config/db');

async function getByFirebaseUid(firebaseUid) {
  const result = await db.call('sp_user_get_by_firebase_uid', [firebaseUid]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0] || null;
}

async function listStaff() {
  const result = await db.call('sp_staff_list', []);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows;
}

async function createStaff({ email, password, firstName, lastName, phone, role, locationId }) {
  const hash = await bcrypt.hash(password, 12);
  const result = await db.call('sp_staff_create', [
    email, hash, firstName, lastName, phone, role, locationId || null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function updateRole(userId, roleId) {
  await db.call('sp_user_update_role', [userId, roleId]);
}

async function updateStaff(userId, { email, firstName, lastName, phone, role, locationId }) {
  const result = await db.call('sp_staff_update', [
    userId, email || null, firstName || null, lastName || null,
    phone !== undefined ? phone : null, role || null, locationId ?? null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function toggleActive(userId, isActive) {
  const result = await db.call('sp_staff_toggle_active', [userId, isActive ? 1 : 0]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function deleteStaff(userId) {
  await db.call('sp_staff_delete', [userId]);
}

module.exports = { getByFirebaseUid, listStaff, createStaff, updateStaff, updateRole, toggleActive, deleteStaff };
