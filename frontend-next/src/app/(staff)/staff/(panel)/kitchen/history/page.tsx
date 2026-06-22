'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Filter, X } from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { api } from '@/lib/api/client';
import { formatCurrency, formatDate, formatTime, formatOrderNumber } from '@/lib/utils/format';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import type { Location } from '@/lib/types';
import type { HistoryOrder } from '@/features/kitchen/types';

export default function KitchenHistory() {
  const { token, user } = useStaffAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(user?.location_id || null);
  const locationId = isAdmin ? selectedLocationId : user?.location_id;

  const { data: locations } = useFetch<Location[]>(isAdmin ? '/locations' : null, token);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin && !selectedLocationId && locations && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [isAdmin, selectedLocationId, locations]);

  const fetchHistory = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ location_id: String(locationId) });
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const data = await api.get<HistoryOrder[]>(`/kitchen/history?${params}`, token);
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

  const hasFilters = Boolean(search || dateFrom || dateTo);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text">Order History</h2>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-text-secondary" />
            <select
              value={selectedLocationId || ''}
              onChange={(e) => setSelectedLocationId(Number(e.target.value))}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {(locations || []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-text-secondary">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Name, phone, email, or order #"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X size={12} /> Clear
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={Filter} title="No orders found" description={hasFilters ? 'Try adjusting your filters.' : 'Orders will appear here once completed.'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Order #</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Payment</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Total</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Date</th>
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
                    <div className="text-xs text-text-secondary">
                      {order.guest_phone && <div>{order.guest_phone}</div>}
                      {order.user_email && <div>{order.user_email}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={order.status_name}>{order.status_name}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {order.payment_status ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          order.payment_status === 'succeeded'
                            ? 'bg-green-50 text-green-700'
                            : order.payment_status === 'refunded'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {order.payment_status}
                      </span>
                    ) : (
                      <span className="text-xs text-text-secondary">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text">{formatCurrency(order.total_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-text-secondary">
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
