const db = require('../../config/db');

async function getOrders(locationId, statusName) {
  const result = await db.call('sp_order_list_by_location', [
    locationId,
    statusName || null,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;

  const enriched = await Promise.all(
    rows.map(async (order) => {
      const itemSets = await db.callMulti('sp_order_get_items', [order.id]);

      // Get payment info
      const payResult = await db.call('sp_payment_get_by_order', [order.id]);
      const payRows = Array.isArray(payResult[0]) ? payResult[0] : payResult;
      const payment = payRows[0] || null;

      return {
        ...order,
        payment_status: payment?.status || null,
        items: (itemSets[0] || []).map((item) => ({
          ...item,
          options: (itemSets[1] || []).filter(
            (opt) => opt.order_item_id === item.id
          ),
        })),
      };
    })
  );

  return enriched;
}

async function getCounts(locationId) {
  const statuses = ['PAID', 'PREPARING', 'READY'];
  const counts = {};

  await Promise.all(
    statuses.map(async (status) => {
      const result = await db.call('sp_order_list_by_location', [locationId, status]);
      const rows = Array.isArray(result[0]) ? result[0] : result;
      counts[status] = Array.isArray(rows) ? rows.length : 0;
    })
  );

  return counts;
}

async function getHistory(locationId, { search, dateFrom, dateTo, limit, offset }) {
  const result = await db.call('sp_order_history', [
    locationId,
    search || null,
    dateFrom || null,
    dateTo || null,
    limit || 50,
    offset || 0,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows;
}

module.exports = { getOrders, getCounts, getHistory };
