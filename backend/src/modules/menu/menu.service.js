const db = require('../../config/db');

async function getFullMenu(locationId) {
  const resultSets = await db.callMulti('sp_menu_get_full', [locationId]);
  return {
    menus: resultSets[0] || [],
    categories: resultSets[1] || [],
    items: resultSets[2] || [],
    options: resultSets[3] || [],
    optionValues: resultSets[4] || [],
  };
}

/**
 * The menu for a location AT A GIVEN PICKUP TIME.
 *
 * Same shape as getFullMenu plus a `period` key, so existing consumers can
 * switch over with minimal change. The pickup time — not the current clock —
 * decides which service period, and therefore which menu, applies. Throws
 * (SQLSTATE 45000 -> 400) when nothing is bookable at that time.
 */
async function getFullMenuForPickup(locationId, pickupTime) {
  const resultSets = await db.callMulti('sp_menu_get_full_for_pickup', [
    locationId,
    pickupTime || null,
  ]);
  return {
    period: (resultSets[0] || [])[0] || null,
    categories: resultSets[1] || [],
    items: resultSets[2] || [],
    options: resultSets[3] || [],
    optionValues: resultSets[4] || [],
  };
}

async function getAllMenu() {
  const resultSets = await db.callMulti('sp_menu_get_all', []);
  return {
    menus: resultSets[0] || [],
    categories: resultSets[1] || [],
    items: resultSets[2] || [],
    options: resultSets[3] || [],
    optionValues: resultSets[4] || [],
    itemLocations: resultSets[5] || [],
  };
}

async function createMenu(name) {
  const result = await db.call('sp_menu_create', [name]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function createCategory({ menuId, name, description, sortOrder }) {
  const result = await db.call('sp_category_create', [
    menuId, name, description || null, sortOrder || 0,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function updateCategory(categoryId, { name, description, sortOrder }) {
  const result = await db.call('sp_category_update', [
    categoryId, name || null, description !== undefined ? description : null, sortOrder !== undefined ? sortOrder : null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function deleteCategory(categoryId) {
  await db.call('sp_category_delete', [categoryId]);
}

async function createItem({ categoryId, name, description, price, imageUrl, sortOrder }) {
  const result = await db.call('sp_item_create', [
    categoryId, name, description || null, price, imageUrl || null, sortOrder || 0,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function updateItem(itemId, { name, description, price, imageUrl, isActive, sortOrder }) {
  const result = await db.call('sp_item_update', [
    itemId,
    name || null,
    description !== undefined ? description : null,
    price || null,
    imageUrl !== undefined ? imageUrl : null,
    isActive !== undefined ? isActive : null,
    sortOrder !== undefined ? sortOrder : null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function deleteItem(itemId) {
  await db.call('sp_item_delete', [itemId]);
}

async function syncItemLocations(itemId, locationIds) {
  const csv = Array.isArray(locationIds) ? locationIds.join(',') : (locationIds || '');
  const result = await db.call('sp_item_location_sync', [itemId, csv]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows;
}

async function createItemOption({ itemId, name, isRequired, maxChoices }) {
  const result = await db.call('sp_item_option_create', [
    itemId, name, isRequired ? 1 : 0, maxChoices || null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function updateItemOption(optionId, { name, isRequired, maxChoices }) {
  const result = await db.call('sp_item_option_update', [
    optionId,
    name || null,
    isRequired === undefined ? null : (isRequired ? 1 : 0),
    maxChoices === undefined ? null : maxChoices,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function deleteItemOption(optionId) {
  await db.call('sp_item_option_delete', [optionId]);
}

// Deep-copy an existing option group (+ its values) onto another item as a new
// independent group. Returns the newly created group row.
async function cloneItemOption({ sourceOptionId, targetItemId }) {
  const result = await db.call('sp_item_option_clone', [sourceOptionId, targetItemId]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function createItemOptionValue({ itemOptionId, name, priceModifier }) {
  const result = await db.call('sp_item_option_value_create', [
    itemOptionId, name, priceModifier || 0,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function updateItemOptionValue(valueId, { name, priceModifier }) {
  const result = await db.call('sp_item_option_value_update', [
    valueId,
    name || null,
    priceModifier === undefined ? null : priceModifier,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function deleteItemOptionValue(valueId) {
  await db.call('sp_item_option_value_delete', [valueId]);
}


// --- Menu <-> category membership (migration 006) ---------------------------
// A category may sit on several menus, so one product can be sold in several
// service periods without duplicating its item row.

/** Every (menu, category) pair, for the admin composition matrix. */
async function listMenuCategories() {
  const result = await db.call('sp_menu_category_list', []);
  return Array.isArray(result[0]) ? result[0] : result;
}

async function attachCategoryToMenu(menuId, categoryId, sortOrder) {
  await db.call('sp_menu_category_attach', [
    menuId,
    categoryId,
    sortOrder !== undefined && sortOrder !== null ? sortOrder : null,
  ]);
}

/** Rejected by the procedure if it would leave the category with no menu. */
async function detachCategoryFromMenu(menuId, categoryId) {
  await db.call('sp_menu_category_detach', [menuId, categoryId]);
}

module.exports = {
  getFullMenu,
  getFullMenuForPickup,
  listMenuCategories,
  attachCategoryToMenu,
  detachCategoryFromMenu,
  getAllMenu,
  createMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  deleteItem,
  syncItemLocations,
  createItemOption,
  updateItemOption,
  deleteItemOption,
  cloneItemOption,
  createItemOptionValue,
  updateItemOptionValue,
  deleteItemOptionValue,
};
