const asyncHandler = require('../../utils/asyncHandler');
const orderService = require('./order.service');

const create = asyncHandler(async (req, res) => {
  const order = await orderService.create({
    locationId: req.body.location_id,
    userId: req.body.user_id || req.user?.id || null,
    guestName: req.body.guest_name,
    guestPhone: req.body.guest_phone,
    pickupTime: req.body.pickup_time,
    notes: req.body.notes,
  });
  res.status(201).json(order);
});

const addItem = asyncHandler(async (req, res) => {
  const item = await orderService.addItem(req.params.id, {
    itemId: req.body.item_id,
    quantity: req.body.quantity,
    notes: req.body.notes,
  });
  res.status(201).json(item);
});

const addItemOption = asyncHandler(async (req, res) => {
  const option = await orderService.addItemOption(
    req.params.itemId,
    req.body.item_option_value_id
  );
  res.status(201).json(option);
});

const removeItem = asyncHandler(async (req, res) => {
  await orderService.removeItem(req.params.itemId);
  res.status(204).end();
});

const calculateTotal = asyncHandler(async (req, res) => {
  const result = await orderService.calculateTotal(req.params.id, req.body.promotion_code);
  res.json(result);
});

const getById = asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
});

const getByTrackingCode = asyncHandler(async (req, res) => {
  const order = await orderService.getByTrackingCode(req.params.trackingCode);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
});

const getItems = asyncHandler(async (req, res) => {
  const data = await orderService.getItems(req.params.id);
  res.json(data);
});

const updateStatus = asyncHandler(async (req, res) => {
  const result = await orderService.updateStatus(req.params.id, req.body.status);
  res.json(result);
});

const prioritize = asyncHandler(async (req, res) => {
  const result = await orderService.prioritize(req.params.id, req.body.reason);
  res.json(result);
});

const cancel = asyncHandler(async (req, res) => {
  const result = await orderService.cancel(req.params.id, req.body.reason);
  res.json(result);
});

const listMyOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.listByUser(req.user.id);
  res.json(orders);
});

// DEV ONLY: simulate payment so orders appear in kitchen
const simulatePay = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const fakeIntentId = `dev_${orderId}_${Date.now()}`;
  const order = await orderService.getById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const db = require('../../config/db');
  await db.call('sp_order_mark_paid', [
    orderId,
    fakeIntentId,
    order.total_amount,
    'USD',
  ]);

  const updated = await orderService.getById(orderId);
  res.json(updated);
});

module.exports = {
  create,
  addItem,
  addItemOption,
  removeItem,
  calculateTotal,
  getById,
  getByTrackingCode,
  getItems,
  updateStatus,
  prioritize,
  cancel,
  listMyOrders,
  simulatePay,
};
