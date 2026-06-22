'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Clock, User, CheckCircle, MapPin, ShieldCheck, AlertTriangle, Tag, X, CalendarClock } from 'lucide-react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useLang } from '@/providers/lang-provider';
import { useClientAuth } from '@/providers/client-auth-provider';
import { useCart } from '@/providers/cart-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { formatCurrency, formatOrderNumber } from '@/lib/utils/format';
import { api, ApiError } from '@/lib/api/client';
import { addGuestOrder } from '@/lib/utils/guest-orders';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import type { Location, Order } from '@/lib/types';

// --------------------------------------------------------------------------
// Pickup-time scheduling helpers (15-min slots, 15-min lead time)
// --------------------------------------------------------------------------
const SLOT_MINUTES = 15;
const MIN_LEAD_MINUTES = 15;

type ScheduleMode = 'no_schedule' | 'before_open' | 'open' | 'closed';
interface Slot {
  minutes: number;
  label: string;
}
interface ScheduleState {
  mode: ScheduleMode;
  slots: Slot[];
  openLabel?: string;
  closeLabel?: string;
}

function timeStringToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}
function minutesToHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
function formatSlotLabel(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function computeScheduleState(location: Location | undefined, now = new Date()): ScheduleState {
  const open = timeStringToMinutes(location?.open_time);
  const close = timeStringToMinutes(location?.close_time);
  if (open == null || close == null) return { mode: 'no_schedule', slots: [] };

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const mode: ScheduleMode = nowMins > close ? 'closed' : nowMins < open ? 'before_open' : 'open';

  const earliest = Math.max(nowMins + MIN_LEAD_MINUTES, open);
  const earliestSlot = Math.ceil(earliest / SLOT_MINUTES) * SLOT_MINUTES;
  const slots: Slot[] = [];
  for (let m = earliestSlot; m <= close; m += SLOT_MINUTES) {
    slots.push({ minutes: m, label: formatSlotLabel(m) });
  }
  return { mode, slots, openLabel: formatSlotLabel(open), closeLabel: formatSlotLabel(close) };
}

/** Local-time DATETIME string (no UTC conversion — backend uses its own tz). */
function buildLocalDateTime(slotMinutes: number, now = new Date()): string {
  const d = new Date(now);
  d.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${minutesToHHMM(slotMinutes)}:00`;
}

interface PaymentStatus {
  stripe_configured: boolean;
  publishable_key?: string | null;
  fee_percent?: number;
  fee_fixed?: number;
}
interface PromoPreview {
  code: string;
  discount_amount: number | string;
  discount_type: string;
  discount_value: number | string;
}
interface AppliedPromo {
  code: string;
  discount_amount: number;
  discount_type: string;
  discount_value: number;
}

// --------------------------------------------------------------------------
// Stripe PaymentElement form
// --------------------------------------------------------------------------
function StripePaymentForm({
  orderId,
  trackingCode,
  onSuccess,
  onError,
}: {
  orderId: number;
  trackingCode: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setPayError(null);

    const returnUrl = `${window.location.origin}/track/${trackingCode}`;
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (error) {
      const msg = error.message || 'Payment failed.';
      setPayError(msg);
      setProcessing(false);
      onError(msg);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        await api.post('/payments/confirm', { order_id: orderId, payment_intent_id: paymentIntent.id });
      } catch (confirmErr) {
        console.warn('[checkout] /payments/confirm failed, relying on webhook:', confirmErr);
      }
      onSuccess();
    } else {
      setPayError('Payment was not completed. Please try again.');
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {payError && (
        <div className="flex items-center gap-2 rounded-lg border border-error/20 bg-red-50 p-3 text-sm text-error">
          <AlertTriangle size={14} /> {payError}
        </div>
      )}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={processing || !stripe}>
        {processing ? (
          <>
            <Spinner size="sm" /> Processing payment...
          </>
        ) : (
          <>
            <CreditCard size={18} /> Pay now
          </>
        )}
      </Button>
    </form>
  );
}

// --------------------------------------------------------------------------
// Main checkout page
// --------------------------------------------------------------------------
export default function CheckoutPage() {
  const { t } = useLang();
  const { isAuthenticated, firebaseUser, user: dbUser } = useClientAuth();
  const { items, total, locationId, clear } = useCart();
  const { data: locations } = useFetch<Location[]>('/locations');
  const currentLocation = (locations || []).find((l) => l.id === locationId);
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);
  const [step, setStep] = useState<'info' | 'payment' | 'processing'>('info');

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  // Re-derive scheduling on a 60s tick so the picker doesn't go stale.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const schedule = computeScheduleState(currentLocation, new Date());
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  useEffect(() => {
    if (schedule.mode === 'before_open') setSelectedSlot(schedule.slots[0]?.minutes ?? null);
    else setSelectedSlot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.mode, currentLocation?.id]);

  const [feeRates, setFeeRates] = useState({ percent: 0, fixed: 0 });

  const subtotal = total;
  const discount = appliedPromo?.discount_amount || 0;
  const preFeeTotal = Math.max(0, subtotal - discount);
  const processingFee = preFeeTotal > 0 ? Math.round((preFeeTotal * feeRates.percent + feeRates.fixed) * 100) / 100 : 0;
  const finalTotal = preFeeTotal + processingFee;

  async function handleApplyPromo(e?: React.SyntheticEvent) {
    e?.preventDefault();
    const code = promoInput.trim();
    if (!code) return;
    setPromoApplying(true);
    setPromoError(null);
    try {
      const result = await api.post<PromoPreview>('/promotions/preview', { code, order_total: subtotal });
      setAppliedPromo({
        code: result.code,
        discount_amount: Number(result.discount_amount) || 0,
        discount_type: result.discount_type,
        discount_value: Number(result.discount_value) || 0,
      });
    } catch (err) {
      setPromoError(err instanceof ApiError ? err.message : 'Invalid promo code.');
      setAppliedPromo(null);
    } finally {
      setPromoApplying(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  }

  // Re-preview the discount if the subtotal changes after applying a promo.
  useEffect(() => {
    if (!appliedPromo) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.post<PromoPreview>('/promotions/preview', { code: appliedPromo.code, order_total: subtotal });
        if (cancelled) return;
        setAppliedPromo((prev) => prev && { ...prev, discount_amount: Number(result.discount_amount) || 0 });
      } catch {
        if (!cancelled) {
          setAppliedPromo(null);
          setPromoError('Promo code no longer valid for this order.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const [form, setForm] = useState({
    guest_name: firebaseUser?.displayName || '',
    guest_phone: '',
    notes: '',
  });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Stripe config + fee rates on mount.
  useEffect(() => {
    api
      .get<PaymentStatus>('/payments/status')
      .then((data) => {
        setStripeConfigured(data.stripe_configured);
        if (data.stripe_configured && data.publishable_key) {
          setStripePromise(loadStripe(data.publishable_key));
        }
        setFeeRates({ percent: Number(data.fee_percent) || 0, fixed: Number(data.fee_fixed) || 0 });
      })
      .catch(() => setStripeConfigured(false));
  }, []);

  function completeOrder(code?: string) {
    const finalCode = code || trackingCode;
    if (finalCode) addGuestOrder(finalCode);
    setSubmitted(true);
    clear();
    if (finalCode) router.replace(`/track/${finalCode}`);
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      if (schedule.mode === 'closed') {
        setError('This location is closed for the day. Please order again tomorrow.');
        setLoading(false);
        return;
      }
      if (schedule.mode === 'before_open' && selectedSlot == null) {
        setError('Please pick a pickup time.');
        setLoading(false);
        return;
      }

      const pickupTimeStr = selectedSlot != null ? buildLocalDateTime(selectedSlot) : null;
      const order = await api.post<Order>('/orders', {
        location_id: locationId,
        user_id: dbUser?.id || null,
        guest_name: form.guest_name || firebaseUser?.displayName || 'Guest',
        guest_phone: form.guest_phone || null,
        notes: form.notes || null,
        pickup_time: pickupTimeStr,
      });

      for (const entry of items) {
        const orderItem = await api.post<{ id: number }>(`/orders/${order.id}/items`, {
          item_id: entry.item.id,
          quantity: entry.quantity,
        });
        for (const opt of entry.options) {
          await api.post(`/orders/${order.id}/items/${orderItem.id}/options`, {
            item_option_value_id: opt.id,
          });
        }
      }

      await api.post(`/orders/${order.id}/calculate`, { promotion_code: appliedPromo?.code || null });

      setOrderId(order.id);
      setDisplayNumber(order.display_number ?? null);
      setTrackingCode(order.tracking_code ?? null);

      if (stripeConfigured && stripePromise) {
        const intent = await api.post<{ client_secret: string }>('/payments/create-intent', { order_id: order.id });
        setClientSecret(intent.client_secret);
        setStep('payment');
      } else {
        setStep('processing');
        try {
          await api.post(`/orders/${order.id}/simulate-pay`);
          completeOrder(order.tracking_code);
        } catch {
          setError('Payment simulation not available. Set NODE_ENV=development or configure Stripe keys.');
          setStep('info');
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place order.');
      setStep('info');
    } finally {
      setLoading(false);
    }
  }

  // Redirect to cart if empty.
  useEffect(() => {
    if (items.length === 0 && !submitted && !loading && step === 'info') router.push('/cart');
  }, [items.length, submitted, loading, step, router]);

  if (items.length === 0 && !submitted && step === 'info') return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => (step === 'payment' ? setStep('info') : router.back())}
          className="text-text-secondary hover:text-text"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-text">{step === 'payment' ? 'Payment' : t.checkout.title}</h1>
      </div>

      {currentLocation && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary-light/30 px-4 py-3">
          <MapPin size={16} className="shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-primary-dark">{currentLocation.name}</p>
            <p className="text-xs text-text-secondary">
              {currentLocation.address}, {currentLocation.city}, {currentLocation.state} {currentLocation.zip_code}
            </p>
          </div>
        </div>
      )}

      {/* STEP 1 — info + summary */}
      {step === 'info' && (
        <form onSubmit={handleCreateOrder} className="space-y-6">
          {schedule.mode === 'closed' && (
            <div className="flex items-start gap-3 rounded-lg border border-error/30 bg-red-50 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-error" />
              <div>
                <p className="text-sm font-semibold text-error">This location is closed</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Service hours: {schedule.openLabel} – {schedule.closeLabel}. Please come back tomorrow.
                </p>
              </div>
            </div>
          )}

          {schedule.mode === 'before_open' && (
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <CalendarClock size={18} className="text-primary" />
                <h2 className="font-semibold text-text">Schedule your pickup</h2>
              </div>
              <p className="mb-4 text-sm text-text-secondary">
                We open at <span className="font-medium text-text">{schedule.openLabel}</span> today. Pick a time and
                we&apos;ll have your order ready.
              </p>
              {schedule.slots.length === 0 ? (
                <p className="text-sm text-error">No pickup slots remaining today.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {schedule.slots.map((slot) => (
                    <button
                      key={slot.minutes}
                      type="button"
                      onClick={() => setSelectedSlot(slot.minutes)}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                        selectedSlot === slot.minutes
                          ? 'border-primary bg-primary font-semibold text-white'
                          : 'border-border bg-surface text-text hover:border-primary/40'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {schedule.mode === 'open' && schedule.slots.length > 0 && (
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <CalendarClock size={18} className="text-primary" />
                <h2 className="font-semibold text-text">Pickup time</h2>
              </div>
              <p className="mb-4 text-sm text-text-secondary">
                Order now or schedule for later today (open until {schedule.closeLabel}).
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                    selectedSlot === null
                      ? 'border-primary bg-primary font-semibold text-white'
                      : 'border-border bg-surface text-text hover:border-primary/40'
                  }`}
                >
                  ASAP
                </button>
                {schedule.slots.map((slot) => (
                  <button
                    key={slot.minutes}
                    type="button"
                    onClick={() => setSelectedSlot(slot.minutes)}
                    className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                      selectedSlot === slot.minutes
                        ? 'border-primary bg-primary font-semibold text-white'
                        : 'border-border bg-surface text-text hover:border-primary/40'
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <User size={18} className="text-primary" />
              <h2 className="font-semibold text-text">{t.checkout.yourInfo}</h2>
            </div>
            {isAuthenticated ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary-light/30 p-3">
                {firebaseUser?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={firebaseUser.photoURL} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                    <User size={18} className="text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{firebaseUser?.displayName}</p>
                  <p className="truncate text-xs text-text-secondary">{firebaseUser?.email}</p>
                </div>
                <CheckCircle size={18} className="shrink-0 text-success" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t.checkout.name} name="guest_name" placeholder={t.checkout.namePlaceholder} value={form.guest_name} onChange={handleChange} required />
                <Input label={t.checkout.phone} name="guest_phone" type="tel" placeholder={t.checkout.phonePlaceholder} value={form.guest_phone} onChange={handleChange} />
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Clock size={18} className="text-primary" />
              <h2 className="font-semibold text-text">{t.checkout.orderDetails}</h2>
            </div>
            <textarea
              name="notes"
              rows={3}
              placeholder={t.checkout.specialPlaceholder}
              value={form.notes}
              onChange={handleChange}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-primary" />
              <h2 className="font-semibold text-text">{t.checkout.orderSummary}</h2>
            </div>
            <div className="space-y-2">
              {items.map((entry) => (
                <div key={entry.key} className="flex justify-between text-sm">
                  <span className="text-text">
                    {entry.quantity}x {entry.item.name}
                    {entry.options.length > 0 && (
                      <span className="text-text-secondary"> ({entry.options.map((o) => o.name).filter(Boolean).join(', ')})</span>
                    )}
                  </span>
                  <span className="font-medium text-text">
                    {formatCurrency((entry.item.price + entry.options.reduce((s, o) => s + (o.price_modifier || 0), 0)) * entry.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-border pt-4">
              {appliedPromo ? (
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-green-700" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">{appliedPromo.code}</p>
                      <p className="text-[11px] text-green-700">
                        {appliedPromo.discount_type === 'percentage'
                          ? `${appliedPromo.discount_value}% off applied`
                          : `${formatCurrency(appliedPromo.discount_value)} off applied`}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={removePromo} className="rounded p-1 text-green-700 hover:bg-green-100" aria-label="Remove promo code">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-text">
                    <Tag size={14} className="text-primary" />
                    Promo code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyPromo(e);
                        }
                      }}
                      placeholder="Enter code"
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
                      disabled={promoApplying}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleApplyPromo} disabled={promoApplying || !promoInput.trim()}>
                      {promoApplying ? 'Checking...' : 'Apply'}
                    </Button>
                  </div>
                  {promoError && <p className="text-xs text-error">{promoError}</p>}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-1.5 border-t border-border pt-4">
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && appliedPromo && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Discount ({appliedPromo.code})</span>
                  <span>−{formatCurrency(discount)}</span>
                </div>
              )}
              {processingFee > 0 && (
                <div className="flex justify-between text-sm text-text-secondary">
                  <span title={`${(feeRates.percent * 100).toFixed(2)}% + ${formatCurrency(feeRates.fixed)} payment processing fee`}>
                    Processing fee
                  </span>
                  <span>{formatCurrency(processingFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 text-lg font-bold">
                <span>{t.checkout.total}</span>
                <span className="text-primary-dark">{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </Card>

          {!stripeConfigured && stripeConfigured !== null && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle size={16} className="shrink-0 text-amber-600" />
              <p className="text-sm text-amber-700">Dev mode — payment will be simulated. Configure Stripe keys for real payments.</p>
            </div>
          )}

          {error && <div className="rounded-lg border border-error/20 bg-red-50 p-3 text-sm text-error">{error}</div>}

          {selectedSlot != null && schedule.mode !== 'closed' && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-text-secondary">
              <CalendarClock size={14} className="text-primary" />
              Pickup at <span className="font-semibold text-text">{formatSlotLabel(selectedSlot)}</span>
            </p>
          )}

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading || schedule.mode === 'closed'}>
            {loading ? (
              <>
                <Spinner size="sm" /> {t.checkout.processing}
              </>
            ) : (
              <>
                <CreditCard size={18} /> {stripeConfigured ? 'Continue to Payment' : t.checkout.placeOrder} &middot;{' '}
                {formatCurrency(finalTotal)}
              </>
            )}
          </Button>
        </form>
      )}

      {/* STEP 2 — Stripe payment */}
      {step === 'payment' && clientSecret && stripePromise && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">
                  Order {formatOrderNumber({ id: orderId ?? 0, display_number: displayNumber })}
                </p>
                {discount > 0 && appliedPromo && (
                  <p className="text-xs text-green-700">
                    {appliedPromo.code} · −{formatCurrency(discount)}
                  </p>
                )}
                <p className="text-lg font-bold text-text">{formatCurrency(finalTotal)}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                {items.reduce((sum, i) => sum + i.quantity, 0)} items
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-primary" />
              <h2 className="font-semibold text-text">Payment</h2>
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <ShieldCheck size={14} className="shrink-0 text-green-600" />
              <p className="text-xs text-green-700">Secured by Stripe. Your payment details never touch our servers.</p>
            </div>
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
              <StripePaymentForm
                orderId={orderId ?? 0}
                trackingCode={trackingCode ?? ''}
                onSuccess={() => completeOrder(trackingCode ?? undefined)}
                onError={(msg) => setError(msg)}
              />
            </Elements>
          </Card>

          {error && <div className="rounded-lg border border-error/20 bg-red-50 p-3 text-sm text-error">{error}</div>}
        </div>
      )}

      {/* Processing */}
      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <Spinner size="lg" />
          <p className="text-text-secondary">Processing your order...</p>
        </div>
      )}
    </div>
  );
}
