import { useState, useEffect, useCallback } from 'react';
import {
  Search, Calendar, MapPin, Filter, X,
  User, Phone, Mail, Package, MessageSquare, Clock, Tag,
} from 'lucide-react';
import { useStaffAuth } from '@shared/context/StaffAuthContext';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatCurrency, formatDate, formatTime, formatOrderNumber, RESTAURANT_TZ } from '@shared/utils/format';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';
import Modal from '@shared/components/Modal';
import EmptyState from '@shared/components/EmptyState';

function PaymentPill({ status }) {
  if (!status) return <span className="text-xs text-text-secondary">--</span>;
  const cls =
    status === 'succeeded' ? 'bg-green-50 text-green-700'
    : status === 'refunded' ? 'bg-amber-50 text-amber-700'
    : 'bg-red-50 text-red-700';
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

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
  // Selected-order detail (opened in a modal). `items === null` = still loading.
  const [detail, setDetail] = useState(null);

  const openDetail = useCallback(async (order) => {
    setDetail({ order, items: null, itemOptions: [] });
    try {
      const [full, itemsData] = await Promise.all([
        api.get(`/orders/${order.id}`, token),
        api.get(`/orders/${order.id}/items`, token),
      ]);
      setDetail({
        order: { ...order, ...(full || {}) },
        items: itemsData?.items || [],
        itemOptions: itemsData?.itemOptions || [],
      });
    } catch {
      setDetail((d) => (d ? { ...d, items: [] } : d));
    }
  }, [token]);

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
                <tr
                  key={order.id}
                  onClick={() => openDetail(order)}
                  className="cursor-pointer hover:bg-primary-light/20 transition-colors"
                  title="View order detail"
                >
                  <td className="px-4 py-3 font-mono">
                    <div className="font-bold text-primary-dark">{formatOrderNumber(order)}</div>
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
                    <PaymentPill status={order.payment_status} />
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

      {/* Order detail (opens when a row is clicked) */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Order ${formatOrderNumber(detail.order)}` : ''}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={detail.order.status_name}>{detail.order.status_name}</Badge>
              <PaymentPill status={detail.order.payment_status} />
              <span className="ml-auto text-xs text-text-secondary">
                {formatDate(detail.order.created_at)} {formatTime(detail.order.created_at)}
              </span>
            </div>

            {/* Customer */}
            <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <User size={15} className="text-text-secondary shrink-0" />
                <span className="font-semibold text-text">
                  {detail.order.guest_name
                    || `${detail.order.user_first_name || ''} ${detail.order.user_last_name || ''}`.trim()
                    || 'Guest'}
                </span>
              </div>
              {(detail.order.guest_phone || detail.order.user_phone || detail.order.user_email) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-xs text-text-secondary">
                  {(detail.order.guest_phone || detail.order.user_phone) && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} /> {detail.order.guest_phone || detail.order.user_phone}
                    </span>
                  )}
                  {detail.order.user_email && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Mail size={12} /> {detail.order.user_email}
                    </span>
                  )}
                </div>
              )}
              {detail.order.pickup_time && (
                <div className="mt-1.5 flex items-center gap-1 pl-6 text-xs text-text-secondary">
                  <Clock size={12} /> Pickup{' '}
                  {new Date(detail.order.pickup_time).toLocaleTimeString([], {
                    hour: 'numeric', minute: '2-digit', timeZone: RESTAURANT_TZ,
                  })}
                </div>
              )}
            </div>

            {/* Customer note */}
            {detail.order.notes && (
              <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare size={13} className="text-accent-hover" />
                  <p className="text-[11px] font-bold uppercase tracking-wide text-accent-hover">Customer note</p>
                </div>
                <p className="text-sm text-text whitespace-pre-wrap break-words">{detail.order.notes}</p>
              </div>
            )}

            {/* Items */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-text">
                <Package size={15} className="text-primary" /> Items
              </div>
              {detail.items === null ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : detail.items.length === 0 ? (
                <p className="text-sm text-text-secondary">No items.</p>
              ) : (
                <div className="space-y-2">
                  {detail.items.map((item) => {
                    const opts = detail.itemOptions.filter((o) => o.order_item_id === item.id);
                    return (
                      <div key={item.id} className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
                        <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary text-text-inverse text-xs font-bold">
                          {item.quantity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text">{item.item_name}</p>
                          {opts.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {opts.map((o) => (
                                <span key={o.id} className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-1.5 py-0.5">
                                  {o.option_value_name}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.notes && <p className="text-xs text-accent-hover mt-1">⚠ {item.notes}</p>}
                        </div>
                        <span className="text-sm font-medium text-text shrink-0">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-3 space-y-1 text-sm">
              {detail.order.subtotal_amount != null && (
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal</span><span>{formatCurrency(detail.order.subtotal_amount)}</span>
                </div>
              )}
              {detail.order.discount_amount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span className="inline-flex items-center gap-1">
                    <Tag size={12} /> Discount{detail.order.promotion_code ? ` (${detail.order.promotion_code})` : ''}
                  </span>
                  <span>−{formatCurrency(detail.order.discount_amount)}</span>
                </div>
              )}
              {detail.order.processing_fee > 0 && (
                <div className="flex justify-between text-text-secondary">
                  <span>Processing fee</span><span>{formatCurrency(detail.order.processing_fee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-text pt-1 border-t border-border">
                <span>Total</span>
                <span className="text-primary-dark">{formatCurrency(detail.order.total_amount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
