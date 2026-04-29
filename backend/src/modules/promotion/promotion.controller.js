const asyncHandler = require('../../utils/asyncHandler');
const promotionService = require('./promotion.service');

const list = asyncHandler(async (_req, res) => {
  const promotions = await promotionService.list();
  res.json(promotions);
});

const create = asyncHandler(async (req, res) => {
  const promo = await promotionService.create(req.body);
  res.status(201).json(promo);
});

const update = asyncHandler(async (req, res) => {
  const promo = await promotionService.update(req.params.id, req.body);
  res.json(promo);
});

const remove = asyncHandler(async (req, res) => {
  await promotionService.remove(req.params.id);
  res.status(204).end();
});

const apply = asyncHandler(async (req, res) => {
  const result = await promotionService.apply(req.body.code, req.body.order_total);
  res.json(result);
});

const preview = asyncHandler(async (req, res) => {
  const result = await promotionService.preview(req.body.code, req.body.order_total);
  res.json(result);
});

module.exports = { list, create, update, remove, apply, preview };
