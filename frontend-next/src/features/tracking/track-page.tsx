'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard, ChefHat, Bell, CheckCircle, Package,
  MapPin, ArrowRight, Search, ShoppingBag, Navigation,
} from 'lucide-react';
import { useLang } from '@/providers/lang-provider';
import { useClientAuth } from '@/providers/client-auth-provider';
import { useSocket } from '@/lib/hooks/use-socket';
import { useFetch } from '@/lib/hooks/use-fetch';
import { api, ApiError } from '@/lib/api/client';
import { formatCurrency, formatTime, formatDate, formatOrderNumber } from '@/lib/utils/format';
import { getGuestOrders, removeGuestOrder } from '@/lib/utils/guest-orders';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import Modal from '@/components/ui/modal';
import type { Location, Order, OrderItemsResponse } from '@/lib/types';

type DirectionUrls = { address: string; google: string; apple: string; waze: string };

function buildDirectionsUrls(location: Location | null | undefined): DirectionUrls | null {
  if (!location) return null;
  const addr = [location.address, location.city, location.state, location.zip_code]
    .filter(Boolean)
    .join(', ');
  const q = encodeURIComponent(addr);
  return {
    address: addr,
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple: `https://maps.apple.com/?daddr=${q}&dirflg=d`,
    waze: `https://www.waze.com/ul?q=${q}&navigate=yes`,
  };
}

function DirectionsModal({
  open,
  onClose,
  location,
}: {
  open: boolean;
  onClose: () => void;
  location: Location | null | undefined;
}) {
  const urls = buildDirectionsUrls(location);
  if (!urls) return null;

  const openIn = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const options = [
    { key: 'google', label: 'Google Maps', sub: 'maps.google.com', emoji: '🗺️' },
    { key: 'apple', label: 'Apple Maps', sub: 'maps.apple.com', emoji: '🧭' },
    { key: 'waze', label: 'Waze', sub: 'waze.com', emoji: '🚗' },
  ] as const;

  return (
    <Modal open={open} onClose={onClose} title="Get directions">
      <p className="mb-4 text-sm text-text-secondary">
        Pick your preferred app — we&apos;ll open it with the route to{' '}
        <span className="font-medium text-text">{urls.address}</span>.
      </p>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => openIn(urls[opt.key])}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary-light/20"
          >
            <span className="text-2xl">{opt.emoji}</span>
            <div className="flex-1">
              <p className="font-medium text-text">{opt.label}</p>
              <p className="text-xs text-text-secondary">{opt.sub}</p>
            </div>
            <ArrowRight size={16} className="text-text-secondary" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

const STEPS = [
  { key: 'PAID', icon: CreditCard, label: 'Paid' },
  { key: 'PREPARING', icon: ChefHat, label: 'Preparing' },
  { key: 'READY', icon: Bell, label: 'Ready' },
  { key: 'COMPLETED', icon: CheckCircle, label: 'Completed' },
] as const;

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus);
  return (
    <div className="flex w-full items-center justify-between">
      {STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="relative flex flex-1 flex-col items-center">
            {idx > 0 && (
              <div className={`absolute top-5 right-1/2 -z-10 h-0.5 w-full ${idx <= currentIdx ? 'bg-primary' : 'bg-border'}`} />
            )}
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                active
                  ? 'scale-110 border-primary bg-primary text-white'
                  : done
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border bg-surface text-text-secondary'
              }`}
            >
              <Icon size={18} />
            </div>
            <span className={`mt-1.5 text-xs font-medium ${active ? 'text-primary-dark' : done ? 'text-primary' : 'text-text-secondary'}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OrderDetail({ trackingCode }: { trackingCode: string }) {
  const { t } = useLang();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDirections, setShowDirections] = useState(false);

  const { data: locations } = useFetch<Location[]>('/locations');
  const orderLocation = (locations || []).find((l) => l.id === order?.location_id);

  const fetchOrder = useCallback(async () => {
    try {
      const orderData = await api.get<Order>(`/orders/track/${trackingCode}`);
      const itemsData = await api.get<OrderItemsResponse>(`/orders/${orderData.id}/items`);
      setOrder(orderData);
      setItems(itemsData);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load order');
    } finally {
      setLoading(false);
    }
  }, [trackingCode]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Live status: poll every 15s + react to kitchen socket events.
  useEffect(() => {
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  useSocket(
    '/kitchen',
    order ? { location_id: order.location_id } : undefined,
    order ? { order_paid: fetchOrder, order_updated: fetchOrder, order_ready: fetchOrder } : undefined,
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Package size={48} className="mx-auto mb-4 text-border" strokeWidth={1.5} />
        <h2 className="text-lg font-semibold text-text">{t.tracking.notFound}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t.tracking.notFoundDesc}</p>
        <Link href="/track" className="mt-4 inline-block">
          <Button variant="outline">{t.tracking.tryAgain}</Button>
        </Link>
      </div>
    );
  }

  const orderItems = items?.items || [];
  const orderOptions = items?.itemOptions || [];

  return (
    <div className="space-y-6">
      <Card className="py-8 text-center">
        <p className="mb-1 text-sm text-text-secondary">
          {t.tracking.order} {formatOrderNumber(order)}
        </p>
        <h2 className="mb-6 text-2xl font-bold text-text">
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

      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
            <MapPin size={20} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">{t.tracking.pickupAt}</p>
            <p className="text-sm font-semibold text-primary-dark">{order.location_name}</p>
            {orderLocation && (
              <p className="mt-0.5 text-xs text-text-secondary">
                {orderLocation.address}, {orderLocation.city}, {orderLocation.state} {orderLocation.zip_code}
              </p>
            )}
          </div>
        </div>
        {orderLocation && (
          <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => setShowDirections(true)}>
            <Navigation size={14} /> Get directions
          </Button>
        )}
      </Card>

      <DirectionsModal open={showDirections} onClose={() => setShowDirections(false)} location={orderLocation} />

      <Card>
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-text">
          <ShoppingBag size={16} className="text-primary" />
          {t.tracking.items}
        </h3>
        <div className="space-y-3">
          {orderItems.map((item) => {
            const opts = orderOptions.filter((o) => o.order_item_id === item.id);
            return (
              <div key={item.id} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary-light text-xs font-bold text-primary">
                  {item.quantity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{item.item_name}</p>
                  {opts.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {opts.map((opt) => (
                        <span key={opt.id} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-text-secondary">
                          {opt.option_value_name}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notes && <p className="mt-0.5 text-xs text-accent">{item.notes}</p>}
                </div>
                <span className="shrink-0 text-sm font-medium text-text">
                  {formatCurrency(item.unit_price * item.quantity)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-between border-t border-border pt-3">
          <span className="font-semibold text-text">{t.tracking.total}</span>
          <span className="font-bold text-primary-dark">{formatCurrency(order.total_amount)}</span>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-text-secondary">{t.tracking.customer}</p>
            <p className="font-medium text-text">{order.guest_name || 'Registered User'}</p>
          </div>
          <div>
            <p className="text-text-secondary">{t.tracking.date}</p>
            <p className="font-medium text-text">
              {order.created_at && `${formatDate(order.created_at)} ${formatTime(order.created_at)}`}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Link href="/order" className="flex-1">
          <Button variant="outline" className="w-full">
            {t.tracking.orderMore} <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function GuestOrderCard({ trackingCode }: { trackingCode: string }) {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    api
      .get<Order>(`/orders/track/${trackingCode}`)
      .then(setOrder)
      .catch(() => removeGuestOrder(trackingCode));
  }, [trackingCode]);

  if (!order) return null;

  const isActive = ['PAID', 'PREPARING', 'READY'].includes(order.status_name);

  return (
    <Link href={`/track/${trackingCode}`}>
      <Card
        className={`flex cursor-pointer items-center gap-4 transition-colors ${
          isActive ? 'border-primary/30 bg-primary-light/20 hover:border-primary/50' : 'hover:border-primary/40'
        }`}
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-primary-light' : 'bg-gray-100'}`}>
          <ShoppingBag size={18} className={isActive ? 'text-primary' : 'text-text-secondary'} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text">{formatOrderNumber(order)}</span>
            <Badge status={order.status_name}>{order.status_name}</Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {order.location_name}
            </span>
            <span>{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
        {isActive && <span className="shrink-0 text-xs font-medium text-primary">Track &rarr;</span>}
      </Card>
    </Link>
  );
}

export default function TrackPage() {
  const { t } = useLang();
  const { isAuthenticated } = useClientAuth();
  const params = useParams<{ code?: string[] }>();
  const trackingCode = params.code?.[0];
  const router = useRouter();
  const [lookupId, setLookupId] = useState('');
  const guestOrders = !isAuthenticated ? getGuestOrders() : [];

  if (trackingCode) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <OrderDetail trackingCode={trackingCode} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
          <Search size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text">{t.tracking.title}</h1>
        <p className="mt-1 text-text-secondary">{t.tracking.subtitle}</p>
      </div>

      {guestOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-text">{t.tracking.recentOrders}</h2>
          <div className="space-y-2">
            {guestOrders.map((go) => (
              <GuestOrderCard key={go.trackingCode} trackingCode={go.trackingCode} />
            ))}
          </div>
        </div>
      )}

      <Card>
        <p className="mb-3 text-xs text-text-secondary">{t.tracking.lookupHint}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (lookupId.trim()) router.push(`/track/${lookupId.trim()}`);
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
