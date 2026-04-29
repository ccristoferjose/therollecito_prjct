const asyncHandler = require('../../utils/asyncHandler');
const locationService = require('./location.service');

const listActive = asyncHandler(async (_req, res) => {
  const locations = await locationService.listActive();
  res.json(locations);
});

const listAll = asyncHandler(async (_req, res) => {
  const locations = await locationService.listAll();
  res.json(locations);
});

const create = asyncHandler(async (req, res) => {
  const location = await locationService.create(req.body);
  res.status(201).json(location);
});

const update = asyncHandler(async (req, res) => {
  const location = await locationService.update(req.params.id, req.body);
  res.json(location);
});

const toggleActive = asyncHandler(async (req, res) => {
  const result = await locationService.toggleActive(req.params.id, req.body.is_active);
  res.json(result);
});

module.exports = { listActive, listAll, create, update, toggleActive };
