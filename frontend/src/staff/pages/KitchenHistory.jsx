import { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, MapPin, Filter, X } from 'lucide-react';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatCurrency, formatDate, formatTime, formatOrderNumber } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';
import EmptyState from '@shared/components/EmptyState';

export default function KitchenHistory() {
  const { token, user } = useStaffAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedLocationId, setSelectedLocationId] = useState(user?.location_id || null);
  const locationId = isAdmin ? selectedLocationId : user?.location_id;

  const { data: locations } = useFetch(isAdmin ? '/locations' : null, token);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin && !selectedLocationId && locations?.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [isAdmin, selectedLocationId, locations]);

  const fetchHistory = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ location_id: locationId });
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const data = await api.get(`/kitchen/history?${params}`, token);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [locationId, search, dateFrom, dateTo, token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function clearFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
  }

  const hasFilters = search || dateFrom || dateTo;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-text">Order History</h2>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-text-secondary" />
            <select
              value={selectedLocationId || ''}
              onChange={(e) => setSelectedLocationId(Number(e.target.value))}
              className="text-sm border border-border rounded-lg px-2 py-1 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {(locations || []).map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-text-secondary mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Name, phone, email, or order #"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X size={12} /> Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Results table */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No orders found"
          description={hasFilters ? 'Try adjusting your filters.' : 'Orders will appear here once completed.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Order #</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Status</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Payment</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">Total</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono">
                    <div className="font-bold text-primary-dark">{formatOrderNumber(order)}</div>
                    <div className="text-[10px] text-text-secondary/70">DB #{order.id}</div>
                  </td>
                  <td className="px-4 py-3 text-text">
                    {order.guest_name || `${order.user_first_name || ''} ${order.user_last_name || ''}`.trim() || 'Guest'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-text-secondary text-xs">
                      {order.guest_phone && <div>{order.guest_phone}</div>}
                      {order.user_email && <div>{order.user_email}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={order.status_name}>{order.status_name}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {order.payment_status ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        order.payment_status === 'succeeded'
                          ? 'bg-green-50 text-green-700'
                          : order.payment_status === 'refunded'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {order.payment_status}
                      </span>
                    ) : (
                      <span className="text-xs text-text-secondary">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text">
                    {formatCurrency(order.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">
                    {formatDate(order.created_at)} {formatTime(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
