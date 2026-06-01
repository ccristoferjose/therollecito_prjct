const asyncHandler = require('../../utils/asyncHandler');
const menuService = require('./menu.service');

const getFullMenu = asyncHandler(async (req, res) => {
  const data = await menuService.getFullMenu(req.params.locationId);
  res.json(data);
});

const getAllMenu = asyncHandler(async (_req, res) => {
  const data = await menuService.getAllMenu();
  res.json(data);
});

const createMenu = asyncHandler(async (req, res) => {
  const menu = await menuService.createMenu(req.body.name);
  res.status(201).json(menu);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await menuService.createCategory(req.body);
  res.status(201).json(category);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await menuService.updateCategory(req.params.id, req.body);
  res.json(category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  await menuService.deleteCategory(req.params.id);
  res.status(204).end();
});

const createItem = asyncHandler(async (req, res) => {
  const item = await menuService.createItem(req.body);
  res.status(201).json(item);
});

const updateItem = asyncHandler(async (req, res) => {
  const item = await menuService.updateItem(req.params.id, req.body);
  res.json(item);
});

const deleteItem = asyncHandler(async (req, res) => {
  await menuService.deleteItem(req.params.id);
  res.status(204).end();
});

const syncItemLocations = asyncHandler(async (req, res) => {
  const result = await menuService.syncItemLocations(req.params.id, req.body.location_ids);
  res.json(result);
});

const createItemOption = asyncHandler(async (req, res) => {
  const option = await menuService.createItemOption(req.body);
  res.status(201).json(option);
});

const updateItemOption = asyncHandler(async (req, res) => {
  const option = await menuService.updateItemOption(req.params.id, req.body);
  res.json(option);
});

const deleteItemOption = asyncHandler(async (req, res) => {
  await menuService.deleteItemOption(req.params.id);
  res.status(204).end();
});

const createItemOptionValue = asyncHandler(async (req, res) => {
  const value = await menuService.createItemOptionValue(req.body);
  res.status(201).json(value);
});

const updateItemOptionValue = asyncHandler(async (req, res) => {
  const value = await menuService.updateItemOptionValue(req.params.id, req.body);
  res.json(value);
});

const deleteItemOptionValue = asyncHandler(async (req, res) => {
  await menuService.deleteItemOptionValue(req.params.id);
  res.status(204).end();
});

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
  updateItemOption,
  deleteItemOption,
  createItemOptionValue,
  updateItemOptionValue,
  deleteItemOptionValue,
};
