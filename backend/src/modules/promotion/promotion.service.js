const db = require('../../config/db');

async function list() {
  const result = await db.call('sp_promotion_list', []);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows;
}

async function create({ code, description, discountType, discountValue, minOrder, maxUses, startsAt, expiresAt }) {
  const result = await db.call('sp_promotion_create', [
    code, description || null, discountType, discountValue,
    minOrder || null, maxUses || null, startsAt, expiresAt || null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function update(id, { code, description, discountType, discountValue, minOrder, maxUses, startsAt, expiresAt, isActive }) {
  const result = await db.call('sp_promotion_update', [
    id,
    code || null,
    description !== undefined ? description : null,
    discountType || null,
    discountValue || null,
    minOrder !== undefined ? minOrder : null,
    maxUses !== undefined ? maxUses : null,
    startsAt || null,
    expiresAt !== undefined ? expiresAt : null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function remove(id) {
  await db.call('sp_promotion_delete', [id]);
}

async function apply(code, orderTotal) {
  const result = await db.call('sp_promotion_apply', [code, orderTotal]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function preview(code, orderTotal) {
  const result = await db.call('sp_promotion_preview', [code, orderTotal]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

module.exports = { list, create, update, remove, apply, preview };
