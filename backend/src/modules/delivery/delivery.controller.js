const asyncHandler = require('../../utils/asyncHandler');
const deliveryService = require('./delivery.service');
const addressUtil = require('./delivery.address');
const deliverySettings = require('./delivery.settings');

const status = asyncHandler(async (_req, res) => {
  res.json(await deliveryService.getStatus());
});

const getSettings = asyncHandler(async (_req, res) => {
  res.json(await deliverySettings.getSettings({ fresh: true }));
});

const updateSettings = asyncHandler(async (req, res) => {
  const result = await deliverySettings.updateSettings(
    {
      minOrderAmount: req.body.min_order_amount,
      customerFeePercent: req.body.customer_fee_percent,
    },
    req.user?.user_id,
  );
  res.json(result);
});

const quote = asyncHandler(async (req, res) => {
  const result = await deliveryService.getQuote({
    locationId: req.body.location_id,
    address: addressUtil.fromRequest(req.body.address),
    pickupTime: req.body.pickup_time || null,
    subtotal: req.body.subtotal,
  });
  res.json(result);
});

const refreshOrderQuote = asyncHandler(async (req, res) => {
  const result = await deliveryService.refreshOrderQuote(req.params.orderId);
  res.json(result);
});

const acceptOrderQuote = asyncHandler(async (req, res) => {
  const result = await deliveryService.acceptOrderQuote(req.params.orderId, req.body.quote_id);
  res.json(result);
});

const retryDispatch = asyncHandler(async (req, res) => {
  const result = await deliveryService.retryDispatch(req.params.orderId);
  res.json(result);
});

/**
 * Provider webhooks send the raw body — express.raw() is mounted in app.js
 * before express.json() for /api/webhooks, so the signature is verified
 * against exactly the bytes the provider signed.
 */
const uberWebhook = asyncHandler(async (req, res) => {
  const result = await deliveryService.handleWebhook(req.body, req.headers, 'uber_direct');
  res.json(result);
});

module.exports = { status, getSettings, updateSettings, quote, refreshOrderQuote, acceptOrderQuote, retryDispatch, uberWebhook };
