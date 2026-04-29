const asyncHandler = require('../../utils/asyncHandler');
const dashboardService = require('./dashboard.service');

const getOverview = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getOverview();
  res.json(data);
});

const getDailyRevenue = asyncHandler(async (req, res) => {
  const locationId = req.query.location_id ? parseInt(req.query.location_id, 10) : null;
  const series = await dashboardService.getDailyRevenue(locationId);
  res.json(series);
});

module.exports = { getOverview, getDailyRevenue };
