import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, DollarSign, MapPin, Users, TrendingUp, TrendingDown,
  Clock, Flame, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatCurrency, formatOrderNumber, timeAgo } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatShortDate(iso) {
  // Render the day in LA, regardless of the browser's local zone.
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

function DeltaBadge({ pct }) {
  if (pct === 0) {
    return <span className="text-xs text-text-secondary">—</span>;
  }
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      <Icon size={12} />
      {up ? '+' : ''}{pct}%
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, subtitle, color }) {
  return (
    <Card className="flex items-start gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-text">{value}</p>
        <p className="text-sm text-text-secondary">{label}</p>
        {subtitle && <div className="mt-0.5">{subtitle}</div>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AdminDashboard() {
  const { token } = useStaffAuth();
  const { data: overview, loading, refetch } = useFetch('/dashboard/overview', token);
  const [chartLocationId, setChartLocationId] = useState('');
  const [series, setSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  const loadSeries = useCallback(async () => {
    setSeriesLoading(true);
    try {
      const qs = chartLocationId ? `?location_id=${chartLocationId}` : '';
      const data = await api.get(`/dashboard/revenue${qs}`, token);
      setSeries(Array.isArray(data) ? data : []);
    } catch {
      setSeries([]);
    } finally {
      setSeriesLoading(false);
    }
  }, [chartLocationId, token]);

  useEffect(() => { loadSeries(); }, [loadSeries]);

  // Auto-refresh the whole overview every 60s
  useEffect(() => {
    const interval = setInterval(() => { refetch(); loadSeries(); }, 60000);
    return () => clearInterval(interval);
  }, [refetch, loadSeries]);

  if (loading || !overview) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  const { kpis, lifetime, counts, locations, recent_orders } = overview;

  const chartData = series.map((row) => ({
    date: formatShortDate(row.day),
    revenue: Number(row.revenue || 0),
    orders: Number(row.order_count || 0),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text">Dashboard</h2>
        <p className="text-xs text-text-secondary">
          All figures use <strong>America/Los_Angeles</strong> time · refreshes every 60s
        </p>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Hero KPI strip                                                 */}
      {/* -------------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="Today's Revenue"
          value={formatCurrency(kpis.today_revenue)}
          subtitle={<DeltaBadge pct={kpis.revenue_delta_pct} />}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Today's Orders"
          value={kpis.today_orders}
          subtitle={<DeltaBadge pct={kpis.orders_delta_pct} />}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          icon={TrendingUp}
          label="Avg Order Value"
          value={formatCurrency(kpis.avg_order_value)}
          subtitle={<span className="text-xs text-text-secondary">today</span>}
          color="bg-purple-50 text-purple-600"
        />
        <KpiCard
          icon={Flame}
          label="Active Orders"
          value={kpis.active_orders}
          subtitle={<span className="text-xs text-text-secondary">in the kitchen now</span>}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Revenue chart (30 days) + location filter                      */}
      {/* -------------------------------------------------------------- */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-text">Revenue — last 30 days</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Daily revenue from paid orders
            </p>
          </div>
          <select
            value={chartLocationId}
            onChange={(e) => setChartLocationId(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="h-64">
          {seriesLoading ? (
            <div className="flex h-full items-center justify-center"><Spinner /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 12,
                  }}
                  formatter={(value, name) => {
                    if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* -------------------------------------------------------------- */}
      {/* Lifetime totals                                                */}
      {/* -------------------------------------------------------------- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Lifetime Revenue</p>
          <p className="text-2xl font-bold text-text mt-1">{formatCurrency(lifetime.revenue)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Lifetime Orders</p>
          <p className="text-2xl font-bold text-text mt-1">{lifetime.orders.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">30-Day Daily Avg</p>
          <p className="text-2xl font-bold text-text mt-1">{formatCurrency(lifetime.avg_daily_30d)}</p>
        </Card>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Per-location breakdown + recent orders                         */}
      {/* -------------------------------------------------------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            <h3 className="font-semibold text-text">Revenue by Location</h3>
          </div>
          {locations.length === 0 ? (
            <p className="p-4 text-sm text-text-secondary">No locations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Location</th>
                    <th className="text-right px-4 py-2 font-medium">Today</th>
                    <th className="text-right px-4 py-2 font-medium">7 days</th>
                    <th className="text-right px-4 py-2 font-medium">30 days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {locations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text">{loc.name}</div>
                        <div className="text-xs text-text-secondary">{loc.city}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-text">{formatCurrency(loc.today_revenue)}</div>
                        <div className="text-xs text-text-secondary">{loc.today_orders} order{loc.today_orders !== 1 ? 's' : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-text">{formatCurrency(loc.week_revenue)}</div>
                        <div className="text-xs text-text-secondary">{loc.week_orders}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-primary-dark">{formatCurrency(loc.month_revenue)}</div>
                        <div className="text-xs text-text-secondary">{loc.month_orders}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padding={false}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              <h3 className="font-semibold text-text">Recent Orders</h3>
            </div>
            <Link to="/staff/admin/history" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {recent_orders.length === 0 ? (
            <p className="p-4 text-sm text-text-secondary">No recent orders yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recent_orders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                  <span className="font-mono font-bold text-primary-dark text-sm w-14">
                    {formatOrderNumber(order)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text truncate">
                        {order.guest_name || 'Registered user'}
                      </p>
                      {order.is_priority ? (
                        <Flame size={12} className="text-red-600 shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-xs text-text-secondary truncate">
                      {order.location_name} · {timeAgo(order.created_at)}
                    </p>
                  </div>
                  <Badge status={order.status_name}>{order.status_name}</Badge>
                  <span className="text-sm font-semibold text-text w-20 text-right">
                    {formatCurrency(order.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Small counts footer */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={MapPin}
          label="Active Locations"
          value={counts.active_locations}
          subtitle={<span className="text-xs text-text-secondary">of {counts.total_locations} total</span>}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          icon={Users}
          label="Registered Users"
          value={counts.total_users}
          color="bg-purple-50 text-purple-600"
        />
      </div>
    </div>
  );
}
