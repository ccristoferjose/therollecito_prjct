const asyncHandler = require('../../utils/asyncHandler');
const kitchenService = require('./kitchen.service');

const getOrders = asyncHandler(async (req, res) => {
  const locationId = req.query.location_id;
  const status = req.query.status || null;
  const orders = await kitchenService.getOrders(locationId, status);
  res.json(orders);
});

const getCounts = asyncHandler(async (req, res) => {
  const locationId = req.query.location_id;
  const counts = await kitchenService.getCounts(locationId);
  res.json(counts);
});

const getHistory = asyncHandler(async (req, res) => {
  const locationId = req.query.location_id;
  const orders = await kitchenService.getHistory(locationId, {
    search: req.query.search || null,
    dateFrom: req.query.date_from || null,
    dateTo: req.query.date_to || null,
    limit: req.query.limit ? parseInt(req.query.limit) : 50,
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
  });
  res.json(orders);
});

module.exports = { getOrders, getCounts, getHistory };
