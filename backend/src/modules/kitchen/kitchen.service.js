const db = require('../../config/db');

/** Default "Upcoming" horizon, in minutes, when the caller does not specify one. */
const DEFAULT_UPCOMING_WINDOW_MINUTES = 30;

/**
 * Attach items (with their options) and the latest payment status to a list of
 * orders, from result sets that were fetched for the whole board at once.
 * Replaces the old per-order sp_order_get_items + sp_payment_get_by_order calls.
 */
function attachDetails(orders, itemRows, optionRows, paymentRows) {
  const optionsByItem = new Map();
  for (const opt of optionRows) {
    const list = optionsByItem.get(opt.order_item_id);
    if (list) list.push(opt);
    else optionsByItem.set(opt.order_item_id, [opt]);
  }

  const itemsByOrder = new Map();
  for (const item of itemRows) {
    const withOptions = { ...item, options: optionsByItem.get(item.id) || [] };
    const list = itemsByOrder.get(item.order_id);
    if (list) list.push(withOptions);
    else itemsByOrder.set(item.order_id, [withOptions]);
  }

  const paymentByOrder = new Map(paymentRows.map((p) => [p.order_id, p]));

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
    payment_status: paymentByOrder.get(order.id)?.status || null,
  }));
}

/**
 * The kitchen board.
 *
 * Buckets are derived in SQL from `prepare_at` (pickup_time minus the service
 * period's prep lead time, falling back to created_at for ASAP orders), so a
 * scheduled order is never shown before the kitchen can act on it. Nothing
 * moves the order between buckets — only NOW() advances.
 *
 * `server_time` is returned so the board can re-bucket locally between polls
 * without trusting the tablet's own clock.
 */
async function getBoard(locationId, upcomingWindowMinutes) {
  const windowMinutes = Number.isFinite(upcomingWindowMinutes)
    ? upcomingWindowMinutes
    : DEFAULT_UPCOMING_WINDOW_MINUTES;

  const rs = await db.callMulti('sp_order_list_kitchen', [locationId, windowMinutes]);
  const [boardRows = [], itemRows = [], optionRows = [], paymentRows = [],
         laterTodayRows = [], scheduledRows = []] = rs;

  const enriched = attachDetails(boardRows, itemRows, optionRows, paymentRows);
  const inBucket = (bucket) => enriched.filter((o) => o.bucket === bucket);

  return {
    queue: inBucket('QUEUE'),
    upcoming: inBucket('UPCOMING'),
    preparing: inBucket('PREPARING'),
    ready: inBucket('READY'),
    // Reference only — the kitchen cannot act on these yet, so no items are
    // loaded. Expanding the section is a local toggle, not another fetch.
    later_today: laterTodayRows,
    scheduled_count: scheduledRows[0]?.scheduled_count ?? 0,
    upcoming_window_minutes: windowMinutes,
    server_time: new Date().toISOString(),
  };
}

/** Future-dated orders for the Scheduled page (tomorrow onwards). */
async function getScheduled(locationId, { dateFrom, dateTo } = {}) {
  const rs = await db.callMulti('sp_order_list_scheduled', [
    locationId,
    dateFrom || null,
    dateTo || null,
  ]);
  const [orderRows = [], itemRows = [], optionRows = []] = rs;

  return {
    orders: attachDetails(orderRows, itemRows, optionRows, []),
    server_time: new Date().toISOString(),
  };
}

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

module.exports = {
  getBoard,
  getScheduled,
  getOrders,
  getCounts,
  getHistory,
  DEFAULT_UPCOMING_WINDOW_MINUTES,
};
