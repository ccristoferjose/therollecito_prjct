const db = require('../../config/db');

function firstRow(result) {
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0] || null;
}

function rows(result) {
  return Array.isArray(result[0]) ? result[0] : result;
}

async function getOverview() {
  const [kpis, lifetime, counts, locationStats, recent] = await Promise.all([
    db.call('sp_dashboard_kpis', []).then(firstRow),
    db.call('sp_dashboard_lifetime', []).then(firstRow),
    db.call('sp_dashboard_counts', []).then(firstRow),
    db.call('sp_dashboard_location_stats', []).then(rows),
    db.call('sp_dashboard_recent_orders', [10]).then(rows),
  ]);

  const todayRev = Number(kpis?.today_revenue || 0);
  const yesterdayRev = Number(kpis?.yesterday_revenue || 0);
  const todayOrd = Number(kpis?.today_orders || 0);
  const yesterdayOrd = Number(kpis?.yesterday_orders || 0);

  const pctDelta = (curr, prev) => {
    if (!prev) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    kpis: {
      today_revenue: todayRev,
      today_orders: todayOrd,
      active_orders: Number(kpis?.active_orders || 0),
      avg_order_value: todayOrd > 0 ? todayRev / todayOrd : 0,
      revenue_delta_pct: pctDelta(todayRev, yesterdayRev),
      orders_delta_pct: pctDelta(todayOrd, yesterdayOrd),
      yesterday_revenue: yesterdayRev,
      yesterday_orders: yesterdayOrd,
    },
    lifetime: {
      revenue: Number(lifetime?.lifetime_revenue || 0),
      orders: Number(lifetime?.lifetime_orders || 0),
      avg_daily_30d: Number(lifetime?.avg_daily_30d || 0),
    },
    counts: {
      active_locations: Number(counts?.active_locations || 0),
      total_locations: Number(counts?.total_locations || 0),
      total_users: Number(counts?.total_users || 0),
    },
    locations: locationStats,
    recent_orders: recent,
  };
}

async function getDailyRevenue(locationId) {
  const result = await db.call('sp_dashboard_daily_revenue', [locationId || null]);
  return rows(result);
}

module.exports = { getOverview, getDailyRevenue };
