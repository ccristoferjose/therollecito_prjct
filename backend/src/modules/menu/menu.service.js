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

async function createItemOptionValue({ itemOptionId, name, priceModifier }) {
  const result = await db.call('sp_item_option_value_create', [
    itemOptionId, name, priceModifier || 0,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

module.exports = {
  getFullMenu,
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
  createItemOptionValue,
};
