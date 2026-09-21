const asyncHandler = require('../../utils/asyncHandler');
const kitchenService = require('./kitchen.service');

// The kitchen board, bucketed by prepare_at. `upcoming_window` is how far ahead
// (in minutes) a scheduled order becomes visible on the board; anything beyond
// it is collapsed into "Later today" or lives on the Scheduled page.
const getBoard = asyncHandler(async (req, res) => {
  const locationId = req.query.location_id;
  const windowMinutes = req.query.upcoming_window
    ? parseInt(req.query.upcoming_window, 10)
    : kitchenService.DEFAULT_UPCOMING_WINDOW_MINUTES;
  const board = await kitchenService.getBoard(locationId, windowMinutes);
  res.json(board);
});

// Future-dated orders — everything from tomorrow onwards.
const getScheduled = asyncHandler(async (req, res) => {
  const locationId = req.query.location_id;
  const scheduled = await kitchenService.getScheduled(locationId, {
    dateFrom: req.query.date_from || null,
    dateTo: req.query.date_to || null,
  });
  res.json(scheduled);
});

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

module.exports = { getBoard, getScheduled, getOrders, getCounts, getHistory };
