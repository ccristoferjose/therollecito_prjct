import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  CreditCard, ChefHat, Bell, CheckCircle, Package,
  MapPin, Clock, ArrowRight, Search, ShoppingBag, Navigation,
  XCircle, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { useLang } from '@shared/context/LangContext';
import { useClientAuth } from '@shared/context/ClientAuthContext';
import { useSocket } from '@shared/hooks/useSocket';
import { useFetch } from '@shared/hooks/useFetch';
import { api } from '@shared/utils/api';
import { formatCurrency, formatTime, formatDate, formatOrderNumber } from '@shared/utils/format';
import { getGuestOrders, removeGuestOrder, addGuestOrder } from '@shared/utils/guestOrders';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Input from '@shared/components/Input';
import Badge from '@shared/components/Badge';
import Spinner from '@shared/components/Spinner';
import Modal from '@shared/components/Modal';

// ---------------------------------------------------------------------------
// Directions: build deep links to the user's preferred maps app.
// Address-based; lat/lng would be more precise but the locations table
// doesn't store coordinates today.
// ---------------------------------------------------------------------------
function buildDirectionsUrls(location) {
  if (!location) return null;
  const addr = [location.address, location.city, location.state, location.zip_code]
    .filter(Boolean).join(', ');
  const q = encodeURIComponent(addr);
  return {
    address: addr,
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple: `https://maps.apple.com/?daddr=${q}&dirflg=d`,
    waze: `https://www.waze.com/ul?q=${q}&navigate=yes`,
  };
}

function DirectionsModal({ open, onClose, location }) {
  const urls = buildDirectionsUrls(location);
  if (!urls) return null;

  // Open in a new tab so the user doesn't lose the tracking page on mobile.
  // noopener/noreferrer prevents the new tab from referencing window.opener.
  const openIn = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const options = [
    { key: 'google', label: 'Google Maps', sub: 'maps.google.com', emoji: '🗺️' },
    { key: 'apple',  label: 'Apple Maps',  sub: 'maps.apple.com',  emoji: '🧭' },
    { key: 'waze',   label: 'Waze',        sub: 'waze.com',        emoji: '🚗' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Get directions">
      <p className="text-sm text-text-secondary mb-4">
        Pick your preferred app — we'll open it with the route to{' '}
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

// Extract the staff cancellation note that sp_order_cancel appends to `notes`
// as "[CANCELED yyyy-mm-dd hh:mm] <reason>".
function parseCancelReason(notes) {
  if (!notes) return null;
  const m = String(notes).match(/\[CANCELED[^\]]*\]\s*([\s\S]+)$/);
  return m ? m[1].trim() : null;
}

// Centered status card for terminal / interstitial states (canceled,
// payment failed, confirming) — replaces the tracking timeline in those cases.
function StatusCard({ icon: Icon, iconClass, title, children, actions }) {
  return (
    <div className="space-y-6">
      <Card className="text-center py-10">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${iconClass}`}>
          <Icon size={32} />
        </div>
        <h2 className="text-2xl font-bold text-text mb-2">{title}</h2>
        {children}
      </Card>
      {actions}
    </div>
  );
}

function OrderDetail({ trackingCode }) {
  const { t } = useLang();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDirections, setShowDirections] = useState(false);
  // Stripe appends these when returning from a redirect payment method
  // (Amazon Pay, wallets, Klarna, …): ?payment_intent=…&redirect_status=…
  const [searchParams] = useSearchParams();
  const redirectStatus = searchParams.get('redirect_status');
  const paymentIntentId = searchParams.get('payment_intent');
  const confirmedRef = useRef(false);

  // Order endpoint only returns location_name; pull the full address list
  // to build maps deep-links. Public endpoint, no auth needed.
  const { data: locations } = useFetch('/locations');
  const orderLocation = (locations || []).find((l) => l.id === order?.location_id);

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

  // Returning from a redirect payment that reported success: expedite marking
  // the order paid instead of waiting on the Stripe webhook, and record it in
  // the guest's recent-orders list (the checkout page never got the chance,
  // since the browser left for the payment provider).
  useEffect(() => {
    if (confirmedRef.current) return;
    if (redirectStatus === 'succeeded' && paymentIntentId && order?.status_name === 'CREATED') {
      confirmedRef.current = true;
      api
        .post('/payments/confirm', { order_id: order.id, payment_intent_id: paymentIntentId })
        .then(() => { addGuestOrder(trackingCode); fetchOrder(); })
        .catch(() => { /* webhook will finalize; polling below keeps checking */ });
    }
  }, [redirectStatus, paymentIntentId, order, trackingCode, fetchOrder]);

  // Auto-refresh — poll faster while a redirect payment is still settling.
  const settling = redirectStatus === 'succeeded' && order?.status_name === 'CREATED';
  useEffect(() => {
    const interval = setInterval(fetchOrder, settling ? 3000 : 15000);
    return () => clearInterval(interval);
  }, [fetchOrder, settling]);

  // Real-time updates via socket
  useSocket(
    '/kitchen',
    order ? { location_id: order.location_id } : null,
    order
      ? {
          order_paid: fetchOrder,
          order_updated: fetchOrder,
          order_ready: fetchOrder,
          order_canceled: fetchOrder,
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

  const orderNo = formatOrderNumber(order);
  const orderMoreBtn = (
    <div className="flex gap-3">
      <Link to="/order" className="flex-1">
        <Button variant="outline" className="w-full">
          {t.tracking.orderMore} <ArrowRight size={16} />
        </Button>
      </Link>
    </div>
  );

  // ---- Canceled / refunded ----
  if (order.status_name === 'CANCELED') {
    const refunded = order.payment_status === 'refunded';
    const reason = parseCancelReason(order.notes);
    return (
      <StatusCard
        icon={XCircle}
        iconClass="bg-red-50 text-error"
        title={t.tracking.canceled}
        actions={orderMoreBtn}
      >
        <p className="text-sm text-text-secondary">{t.tracking.order} {orderNo}</p>
        {refunded ? (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            <p className="font-semibold">{t.tracking.refundIssued}</p>
            <p className="mt-0.5">
              {t.tracking.refundedPre}{' '}
              <span className="font-semibold">{formatCurrency(order.total_amount)}</span>{' '}
              {t.tracking.refundedPost}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">{t.tracking.canceledDesc}</p>
        )}
        {reason && (
          <div className="mt-4 text-left rounded-lg bg-gray-50 border border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1">
              {t.tracking.cancelReason}
            </p>
            <p className="text-sm text-text">{reason}</p>
          </div>
        )}
      </StatusCard>
    );
  }

  // ---- Payment not completed (order created but never paid / failed) ----
  if (order.status_name === 'CREATED') {
    if (settling) {
      return (
        <StatusCard
          icon={CreditCard}
          iconClass="bg-primary-light text-primary"
          title={t.tracking.confirming}
        >
          <div className="flex justify-center my-2"><Spinner size="md" /></div>
          <p className="text-sm text-text-secondary">{t.tracking.confirmingDesc}</p>
        </StatusCard>
      );
    }
    const failed = redirectStatus === 'failed';
    return (
      <StatusCard
        icon={AlertTriangle}
        iconClass="bg-red-50 text-error"
        title={failed ? t.tracking.paymentFailed : t.tracking.paymentPending}
        actions={
          <div className="flex gap-3">
            <Link to="/cart" className="flex-1">
              <Button variant="accent" className="w-full">
                <RotateCcw size={16} /> {t.tracking.tryAgain}
              </Button>
            </Link>
            <Link to="/order" className="flex-1">
              <Button variant="outline" className="w-full">{t.tracking.backToMenu}</Button>
            </Link>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">{t.tracking.order} {orderNo}</p>
        <p className="mt-3 text-sm text-text-secondary">
          {failed ? t.tracking.paymentFailedDesc : t.tracking.paymentPendingDesc}
        </p>
        <p className="mt-2 text-sm font-medium text-success">{t.tracking.notCharged}</p>
      </StatusCard>
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
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
            <MapPin size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text">{t.tracking.pickupAt}</p>
            <p className="text-sm text-primary-dark font-semibold">{order.location_name}</p>
            {orderLocation && (
              <p className="text-xs text-text-secondary mt-0.5">
                {orderLocation.address}, {orderLocation.city}, {orderLocation.state} {orderLocation.zip_code}
              </p>
            )}
          </div>
        </div>
        {orderLocation && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => setShowDirections(true)}
          >
            <Navigation size={14} /> Get directions
          </Button>
        )}
      </Card>

      <DirectionsModal
        open={showDirections}
        onClose={() => setShowDirections(false)}
        location={orderLocation}
      />

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
