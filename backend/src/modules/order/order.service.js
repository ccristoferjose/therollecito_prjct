const db = require('../../config/db');
const { getIO } = require('../../sockets');

function emitOrderEvent(eventName, locationId, data) {
  const io = getIO();
  if (io) {
    io.of('/kitchen').to(`location_${locationId}`).emit(eventName, {
      ...data,
      timestamp: Date.now(),
    });
  }
}

async function create({ locationId, userId, guestName, guestPhone, pickupTime, notes }) {
  const result = await db.call('sp_order_create', [
    locationId,
    userId || null,
    guestName || null,
    guestPhone || null,
    pickupTime || null,
    notes || null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const order = rows[0];

  emitOrderEvent('order_created', locationId, {
    order_id: order.id,
    location_id: order.location_id,
    status: order.status_name,
  });

  return order;
}

async function addItem(orderId, { itemId, quantity, notes }) {
  const result = await db.call('sp_order_add_item', [
    orderId,
    itemId,
    quantity || 1,
    notes || null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function addItemOption(orderItemId, itemOptionValueId) {
  const result = await db.call('sp_order_add_item_option', [
    orderItemId,
    itemOptionValueId,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function removeItem(orderItemId) {
  await db.call('sp_order_remove_item', [orderItemId]);
}

async function calculateTotal(orderId, promotionCode) {
  const env = require('../../config/env');
  const result = await db.call('sp_order_calculate_total', [
    orderId,
    promotionCode || null,
    env.stripe.feePercent,
    env.stripe.feeFixed,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

async function getById(orderId) {
  const result = await db.call('sp_order_get', [orderId]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0] || null;
}

async function getByTrackingCode(trackingCode) {
  const result = await db.call('sp_order_get_by_tracking_code', [trackingCode]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0] || null;
}

async function getItems(orderId) {
  const resultSets = await db.callMulti('sp_order_get_items', [orderId]);
  return {
    items: resultSets[0] || [],
    itemOptions: resultSets[1] || [],
  };
}

async function updateStatus(orderId, newStatus) {
  const result = await db.call('sp_order_update_status', [orderId, newStatus]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const order = rows[0];

  // Get full order for location_id
  const fullOrder = await getById(orderId);

  const eventMap = {
    PAID: 'order_paid',
    PREPARING: 'order_updated',
    READY: 'order_ready',
    COMPLETED: 'order_updated',
  };

  emitOrderEvent(eventMap[newStatus] || 'order_updated', fullOrder.location_id, {
    order_id: orderId,
    location_id: fullOrder.location_id,
    status: newStatus,
  });

  return order;
}

async function prioritize(orderId, reason) {
  const result = await db.call('sp_order_prioritize', [orderId, reason]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const order = rows[0];

  const fullOrder = await getById(orderId);
  emitOrderEvent('order_priority', fullOrder.location_id, {
    order_id: parseInt(orderId, 10),
    location_id: fullOrder.location_id,
    status: 'PAID',
    is_priority: true,
    reason,
  });
  // Also fire order_updated so every open tab refetches lists
  emitOrderEvent('order_updated', fullOrder.location_id, {
    order_id: parseInt(orderId, 10),
    location_id: fullOrder.location_id,
  });

  return order;
}

async function cancel(orderId, reason) {
  const paymentService = require('../payment/payment.service');

  const current = await getById(orderId);
  if (!current) {
    const err = new Error('Order not found.');
    err.statusCode = 404;
    throw err;
  }

  let refund = null;
  // Only active PAID/PREPARING/READY orders have a charge to refund.
  // CREATED orders never had payment collected.
  if (['PAID', 'PREPARING', 'READY'].includes(current.status_name)) {
    refund = await paymentService.refundOrder(orderId);
  }

  const result = await db.call('sp_order_cancel', [orderId, reason]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  const order = rows[0];

  emitOrderEvent('order_canceled', current.location_id, {
    order_id: parseInt(orderId, 10),
    location_id: current.location_id,
    refund,
  });

  return { order, refund };
}

async function listByUser(userId) {
  const result = await db.call('sp_order_list_by_user', [userId]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows;
}

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
  listByUser,
};
