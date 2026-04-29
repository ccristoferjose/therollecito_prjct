import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CreditCard, ChefHat, Bell, CheckCircle, Package,
  MapPin, Clock, ArrowRight, Search, ShoppingBag,
} from 'lucide-react';
import { useLang } from '@shared/context/LangContext';
import { useClientAuth } from '@shared/context/ClientAuthContext';
import { useSocket } from '@shared/hooks/useSocket';
import { api } from '@shared/utils/api';
import { formatCurrency, formatTime, formatDate, formatOrderNumber } from '@shared/utils/format';
import { getGuestOrders, removeGuestOrder } from '@shared/utils/guestOrders';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Input from '@shared/components/Input';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';

const STEPS = [
  { key: 'PAID', icon: CreditCard, label: 'Paid' },
  { key: 'PREPARING', icon: ChefHat, label: 'Preparing' },
  { key: 'READY', icon: Bell, label: 'Ready' },
  { key: 'COMPLETED', icon: CheckCircle, label: 'Completed' },
];

function StatusTimeline({ currentStatus }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center justify-between w-full">
      {STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-col items-center flex-1 relative">
            {/* Connector line */}
            {idx > 0 && (
              <div
                className={`absolute top-5 right-1/2 w-full h-0.5 -z-10 ${
                  idx <= currentIdx ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
            {/* Circle */}
            <div
              className={`flex items-center justify-center h-10 w-10 rounded-full border-2 transition-all ${
                active
                  ? 'border-primary bg-primary text-white scale-110'
                  : done
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border bg-surface text-text-secondary'
              }`}
            >
              <Icon size={18} />
            </div>
            <span
              className={`text-xs mt-1.5 font-medium ${
                active ? 'text-primary-dark' : done ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OrderDetail({ trackingCode }) {
  const { t } = useLang();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrder = useCallback(async () => {
    try {
      // Fetch by tracking code (UUID) — public, no auth needed
      const orderData = await api.get(`/orders/track/${trackingCode}`);
      const itemsData = await api.get(`/orders/${orderData.id}/items`);
      setOrder(orderData);
      setItems(itemsData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [trackingCode]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  // Real-time updates via socket
  useSocket(
    '/kitchen',
    order ? { location_id: order.location_id } : null,
    order
      ? {
          order_paid: fetchOrder,
          order_updated: fetchOrder,
          order_ready: fetchOrder,
        }
      : {}
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Package size={48} className="mx-auto mb-4 text-border" strokeWidth={1.5} />
        <h2 className="text-lg font-semibold text-text">{t.tracking.notFound}</h2>
        <p className="text-sm text-text-secondary mt-1">{t.tracking.notFoundDesc}</p>
        <Link to="/track" className="mt-4 inline-block">
          <Button variant="outline">{t.tracking.tryAgain}</Button>
        </Link>
      </div>
    );
  }

  const orderItems = items?.items || [];
  const orderOptions = items?.itemOptions || [];

  return (
    <div className="space-y-6">
      {/* Status header */}
      <Card className="text-center py-8">
        <p className="text-sm text-text-secondary mb-1">{t.tracking.order} {formatOrderNumber(order)}</p>
        <h2 className="text-2xl font-bold text-text mb-6">
          {order.status_name === 'COMPLETED'
            ? t.tracking.completed
            : order.status_name === 'READY'
            ? t.tracking.ready
            : order.status_name === 'PREPARING'
            ? t.tracking.preparing
            : t.tracking.received}
        </h2>
        <StatusTimeline currentStatus={order.status_name} />
      </Card>

      {/* Location */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
            <MapPin size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">{t.tracking.pickupAt}</p>
            <p className="text-sm text-primary-dark font-semibold">{order.location_name}</p>
          </div>
        </div>
      </Card>

      {/* Order items */}
      <Card>
        <h3 className="font-semibold text-text mb-3 flex items-center gap-2">
          <ShoppingBag size={16} className="text-primary" />
          {t.tracking.items}
        </h3>
        <div className="space-y-3">
          {orderItems.map((item) => {
            const opts = orderOptions.filter((o) => o.order_item_id === item.id);
            return (
              <div key={item.id} className="flex items-start gap-3">
                <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded bg-primary-light text-primary text-xs font-bold">
                  {item.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{item.item_name}</p>
                  {opts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {opts.map((opt) => (
                        <span
                          key={opt.id}
                          className="text-[11px] bg-gray-100 text-text-secondary rounded px-1.5 py-0.5"
                        >
                          {opt.option_value_name}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-xs text-accent mt-0.5">{item.notes}</p>
                  )}
                </div>
                <span className="text-sm font-medium text-text shrink-0">
                  {formatCurrency(item.unit_price * item.quantity)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-border flex justify-between">
          <span className="font-semibold text-text">{t.tracking.total}</span>
          <span className="font-bold text-primary-dark">{formatCurrency(order.total_amount)}</span>
        </div>
      </Card>

      {/* Order info */}
      <Card>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-text-secondary">{t.tracking.customer}</p>
            <p className="font-medium text-text">{order.guest_name || 'Registered User'}</p>
          </div>
          <div>
            <p className="text-text-secondary">{t.tracking.date}</p>
            <p className="font-medium text-text">
              {formatDate(order.created_at)} {formatTime(order.created_at)}
            </p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Link to="/order" className="flex-1">
          <Button variant="outline" className="w-full">
            {t.tracking.orderMore} <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function GuestOrderCard({ trackingCode }) {
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.get(`/orders/track/${trackingCode}`)
      .then(setOrder)
      .catch(() => {
        // Order not found — remove from guest storage
        removeGuestOrder(trackingCode);
      });
  }, [trackingCode]);

  if (!order) return null;

  const isActive = ['PAID', 'PREPARING', 'READY'].includes(order.status_name);

  return (
    <Link to={`/track/${trackingCode}`}>
      <Card className={`flex items-center gap-4 cursor-pointer transition-colors ${
        isActive ? 'border-primary/30 bg-primary-light/20 hover:border-primary/50' : 'hover:border-primary/40'
      }`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          isActive ? 'bg-primary-light' : 'bg-gray-100'
        }`}>
          <ShoppingBag size={18} className={isActive ? 'text-primary' : 'text-text-secondary'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text">{formatOrderNumber(order)}</span>
            <Badge status={order.status_name}>{order.status_name}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-secondary mt-0.5">
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {order.location_name}
            </span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
        {isActive && (
          <span className="text-xs font-medium text-primary shrink-0">
            Track &rarr;
          </span>
        )}
      </Card>
    </Link>
  );
}

export default function OrderTrackingPage() {
  const { t } = useLang();
  const { isAuthenticated } = useClientAuth();
  const { trackingCode } = useParams();
  const navigate = useNavigate();
  const [lookupId, setLookupId] = useState('');
  const guestOrders = !isAuthenticated ? getGuestOrders() : [];

  // If tracking code in URL, show order detail
  if (trackingCode) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <OrderDetail trackingCode={trackingCode} />
      </div>
    );
  }

  // Otherwise show recent orders + lookup
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
          <Search size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text">{t.tracking.title}</h1>
        <p className="mt-1 text-text-secondary">{t.tracking.subtitle}</p>
      </div>

      {/* Guest recent orders */}
      {guestOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-text mb-3">
            {t.tracking.recentOrders || 'Your Recent Orders'}
          </h2>
          <div className="space-y-2">
            {guestOrders.map((go) => (
              <GuestOrderCard key={go.trackingCode} trackingCode={go.trackingCode} />
            ))}
          </div>
        </div>
      )}

      {/* Manual lookup */}
      <Card>
        <p className="text-xs text-text-secondary mb-3">
          {t.tracking.lookupHint || 'Have a tracking code? Enter it below.'}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (lookupId.trim()) navigate(`/track/${lookupId.trim()}`);
          }}
          className="space-y-3"
        >
          <Input
            label={t.tracking.orderNumber}
            placeholder="e.g. a8f2e9b1-4c3d-..."
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" className="w-full" size="md">
            <Search size={16} /> {t.tracking.trackButton}
          </Button>
        </form>
      </Card>
    </div>
  );
}
