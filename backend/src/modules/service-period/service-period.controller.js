const asyncHandler = require('../../utils/asyncHandler');
const servicePeriodService = require('./service-period.service');

// Public: which period (and therefore which menu) applies to a pickup time.
// 200 with null when nothing is bookable then — "closed" is a normal answer to
// this question, not an error, so the picker can grey the slot out.
const resolve = asyncHandler(async (req, res) => {
  const period = await servicePeriodService.resolve(
    req.params.locationId,
    req.query.pickupTime,
  );
  res.json({ period });
});

// Public: periods still bookable on a date, each with its earliest valid pickup.
const listBookable = asyncHandler(async (req, res) => {
  const periods = await servicePeriodService.listBookable(
    req.params.locationId,
    req.query.date,
  );
  res.json({ periods });
});

// Public: re-check a cart after the customer changes pickup time.
const validateCart = asyncHandler(async (req, res) => {
  const result = await servicePeriodService.validateCart(
    req.params.locationId,
    req.body.pickup_time,
    req.body.item_ids,
  );
  res.json(result);
});

// Admin
const listByLocation = asyncHandler(async (req, res) => {
  const data = await servicePeriodService.listByLocation(req.params.locationId);
  res.json(data);
});

const create = asyncHandler(async (req, res) => {
  const period = await servicePeriodService.create({
    locationId: req.body.location_id,
    menuId: req.body.menu_id,
    name: req.body.name,
    prepTimeMinutes: req.body.prep_time_minutes,
    sortOrder: req.body.sort_order,
  });
  res.status(201).json(period);
});

const update = asyncHandler(async (req, res) => {
  await servicePeriodService.update(req.params.id, {
    menuId: req.body.menu_id,
    name: req.body.name,
    prepTimeMinutes: req.body.prep_time_minutes,
    sortOrder: req.body.sort_order,
    isActive: req.body.is_active,
  });
  res.status(204).end();
});

const setSchedule = asyncHandler(async (req, res) => {
  await servicePeriodService.setSchedule(req.params.id, {
    dayOfWeek: req.body.day_of_week,
    startTime: req.body.start_time,
    endTime: req.body.end_time,
  });
  res.status(204).end();
});

const clearSchedule = asyncHandler(async (req, res) => {
  await servicePeriodService.clearSchedule(req.params.id, req.params.dayOfWeek);
  res.status(204).end();
});

const remove = asyncHandler(async (req, res) => {
  const result = await servicePeriodService.remove(req.params.id);
  res.json({ result });
});

module.exports = {
  resolve,
  listBookable,
  validateCart,
  listByLocation,
  create,
  update,
  setSchedule,
  clearSchedule,
  remove,
};
