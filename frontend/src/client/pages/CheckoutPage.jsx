import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Clock, User, CheckCircle, MapPin, ShieldCheck, AlertTriangle, Tag, X } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useLang } from '@shared/context/LangContext';
import { useClientAuth } from '@shared/context/ClientAuthContext';
import { useCart } from '@shared/context/CartContext';
import { useFetch } from '@shared/hooks/useFetch';
import { formatCurrency, formatOrderNumber } from '@shared/utils/format';
import { api } from '@shared/utils/api';
import Card from '@shared/components/Card';
import Button from '@shared/components/Button';
import Input from '@shared/components/Input';
import Spinner from '@shared/components/Spinner';
import { addGuestOrder } from '@shared/utils/guestOrders';

// ---------------------------------------------------------------------------
// Stripe-powered payment form — uses PaymentElement so Stripe can surface
// every payment method enabled on the dashboard (card, Apple Pay, Google Pay,
// Link, Cash App, Klarna, etc.). A redirect `return_url` is required for
// methods that need one (wallets, BNPL); it points to the tracking page so
// the user lands cleanly after authentication.
// ---------------------------------------------------------------------------
function StripePaymentForm({ orderId, trackingCode, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState(null);

  async function handlePay(e) {
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
      setPayError(error.message);
      setProcessing(false);
      onError(error.message);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        await api.post('/payments/confirm', {
          order_id: orderId,
          payment_intent_id: paymentIntent.id,
        });
      } catch (confirmErr) {
        console.warn('[checkout] /payments/confirm failed, relying on webhook:', confirmErr);
      }
      onSuccess();
    } else {
      // For redirect-based methods the browser navigates away before we
      // reach this branch. For inline methods that aren't immediately
      // succeeded (extremely rare), surface a generic retry message.
      setPayError('Payment was not completed. Please try again.');
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {payError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-error/20 p-3 text-sm text-error">
          <AlertTriangle size={14} /> {payError}
        </div>
      )}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={processing || !stripe}>
        {processing ? (
          <><Spinner size="sm" /> Processing payment...</>
        ) : (
          <><CreditCard size={18} /> Pay now</>
        )}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main checkout page
// ---------------------------------------------------------------------------
export default function CheckoutPage() {
  const { t } = useLang();
  const { isAuthenticated, firebaseUser, user: dbUser } = useClientAuth();
  const { items, total, locationId, clear } = useCart();
  const { data: locations } = useFetch('/locations');
  const currentLocation = (locations || []).find((l) => l.id === locationId);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Payment state
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [displayNumber, setDisplayNumber] = useState(null);
  const [trackingCode, setTrackingCode] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(null);
  const [step, setStep] = useState('info'); // 'info' | 'payment' | 'processing'

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null); // { code, discount_amount, discount_type, discount_value }

  const subtotal = total;
  const discount = appliedPromo?.discount_amount || 0;
  const finalTotal = Math.max(0, subtotal - discount);

  async function handleApplyPromo(e) {
    e?.preventDefault();
    const code = promoInput.trim();
    if (!code) return;
    setPromoApplying(true);
    setPromoError(null);
    try {
      const result = await api.post('/promotions/preview', {
        code,
        order_total: subtotal,
      });
      setAppliedPromo({
        code: result.code,
        discount_amount: Number(result.discount_amount) || 0,
        discount_type: result.discount_type,
        discount_value: Number(result.discount_value) || 0,
      });
    } catch (err) {
      setPromoError(err?.message || 'Invalid promo code.');
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

  // If the cart subtotal changes after a promo is applied (e.g. user goes
  // back and edits), re-preview so the discount stays accurate.
  useEffect(() => {
    if (!appliedPromo) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.post('/promotions/preview', {
          code: appliedPromo.code,
          order_total: subtotal,
        });
        if (cancelled) return;
        setAppliedPromo((prev) => prev && {
          ...prev,
          discount_amount: Number(result.discount_amount) || 0,
        });
      } catch {
        if (!cancelled) {
          setAppliedPromo(null);
          setPromoError('Promo code no longer valid for this order.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState({
    guest_name: firebaseUser?.displayName || '',
    guest_phone: '',
    notes: '',
  });

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Check Stripe status on mount
  useEffect(() => {
    api.get('/payments/status').then((data) => {
      setStripeConfigured(data.stripe_configured);
      if (data.stripe_configured && data.publishable_key) {
        setStripePromise(loadStripe(data.publishable_key));
      }
    }).catch(() => setStripeConfigured(false));
  }, []);

  // Create order and proceed to payment
  async function handleCreateOrder(e) {
    e.preventDefault();
    if (items.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Create the order
      const order = await api.post('/orders', {
        location_id: locationId,
        user_id: dbUser?.id || null,
        guest_name: form.guest_name || firebaseUser?.displayName || 'Guest',
        guest_phone: form.guest_phone || null,
        notes: form.notes || null,
      });

      // 2. Add items and their options
      for (const entry of items) {
        const orderItem = await api.post(`/orders/${order.id}/items`, {
          item_id: entry.item.id,
          quantity: entry.quantity,
        });
        for (const opt of entry.options) {
          await api.post(`/orders/${order.id}/items/${orderItem.id}/options`, {
            item_option_value_id: opt.id,
          });
        }
      }

      // 3. Calculate total on the server (applies promo if present)
      await api.post(`/orders/${order.id}/calculate`, {
        promotion_code: appliedPromo?.code || null,
      });

      setOrderId(order.id);
      setDisplayNumber(order.display_number);
      setTrackingCode(order.tracking_code);

      // 4. If Stripe is configured, create PaymentIntent and show card form
      if (stripeConfigured && stripePromise) {
        const intent = await api.post('/payments/create-intent', { order_id: order.id });
        setClientSecret(intent.client_secret);
        setStep('payment');
      } else {
        // Dev mode — simulate payment directly
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
      setError(err.message);
      setStep('info');
    } finally {
      setLoading(false);
    }
  }

  function completeOrder(code) {
    addGuestOrder(code || trackingCode);
    setSubmitted(true);
    clear();
    navigate(`/track/${code || trackingCode}`, { replace: true });
  }

  // Redirect to cart if empty
  useEffect(() => {
    if (items.length === 0 && !submitted && !loading && step === 'info') navigate('/cart');
  }, [items.length, submitted, loading, step, navigate]);

  if (items.length === 0 && !submitted && step === 'info') return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step === 'payment' ? setStep('info') : navigate(-1)} className="text-text-secondary hover:text-text">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-text">
          {step === 'payment' ? 'Payment' : t.checkout.title}
        </h1>
      </div>

      {currentLocation && (
        <div className="flex items-center gap-2 mb-6 rounded-lg border border-primary/20 bg-primary-light/30 px-4 py-3">
          <MapPin size={16} className="text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary-dark">{currentLocation.name}</p>
            <p className="text-xs text-text-secondary">
              {currentLocation.address}, {currentLocation.city}, {currentLocation.state} {currentLocation.zip_code}
            </p>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 1: Order info + summary                                 */}
      {/* ============================================================ */}
      {step === 'info' && (
        <form onSubmit={handleCreateOrder} className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <User size={18} className="text-primary" />
              <h2 className="font-semibold text-text">{t.checkout.yourInfo}</h2>
            </div>

            {isAuthenticated ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary-light/30 p-3">
                {firebaseUser?.photoURL ? (
                  <img src={firebaseUser.photoURL} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                    <User size={18} className="text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{firebaseUser?.displayName}</p>
                  <p className="text-xs text-text-secondary truncate">{firebaseUser?.email}</p>
                </div>
                <CheckCircle size={18} className="text-success shrink-0" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t.checkout.name} name="guest_name" placeholder={t.checkout.namePlaceholder} value={form.guest_name} onChange={handleChange} required />
                <Input label={t.checkout.phone} name="guest_phone" type="tel" placeholder={t.checkout.phonePlaceholder} value={form.guest_phone} onChange={handleChange} />
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-primary" />
              <h2 className="font-semibold text-text">{t.checkout.orderDetails}</h2>
            </div>
            <textarea
              name="notes"
              rows={3}
              placeholder={t.checkout.specialPlaceholder}
              value={form.notes}
              onChange={handleChange}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={18} className="text-primary" />
              <h2 className="font-semibold text-text">{t.checkout.orderSummary}</h2>
            </div>
            <div className="space-y-2">
              {items.map((entry) => (
                <div key={entry.key} className="flex justify-between text-sm">
                  <span className="text-text">
                    {entry.quantity}x {entry.item.name}
                    {entry.options.length > 0 && (
                      <span className="text-text-secondary"> ({entry.options.map((o) => o.name).join(', ')})</span>
                    )}
                  </span>
                  <span className="font-medium text-text">
                    {formatCurrency(
                      (entry.item.price + entry.options.reduce((s, o) => s + (o.price_modifier || 0), 0)) * entry.quantity
                    )}
                  </span>
                </div>
              ))}
            </div>
            {/* Promo code */}
            <div className="mt-4 border-t border-border pt-4">
              {appliedPromo ? (
                <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2">
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
                  <button
                    type="button"
                    onClick={removePromo}
                    className="p-1 rounded hover:bg-green-100 text-green-700"
                    aria-label="Remove promo code"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text flex items-center gap-1.5">
                    <Tag size={14} className="text-primary" />
                    Promo code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(e); } }}
                      placeholder="Enter code"
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
                      disabled={promoApplying}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyPromo}
                      disabled={promoApplying || !promoInput.trim()}
                    >
                      {promoApplying ? 'Checking...' : 'Apply'}
                    </Button>
                  </div>
                  {promoError && <p className="text-xs text-error">{promoError}</p>}
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-border pt-4 space-y-1.5">
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Discount ({appliedPromo.code})</span>
                  <span>−{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-1.5 border-t border-border">
                <span>{t.checkout.total}</span>
                <span className="text-primary-dark">{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </Card>

          {!stripeConfigured && stripeConfigured !== null && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700">
                Dev mode — payment will be simulated. Configure Stripe keys for real payments.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-error/20 p-3 text-sm text-error">{error}</div>
          )}

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <><Spinner size="sm" /> {t.checkout.processing}</>
            ) : (
              <><CreditCard size={18} /> {stripeConfigured ? 'Continue to Payment' : t.checkout.placeOrder} &middot; {formatCurrency(finalTotal)}</>
            )}
          </Button>
        </form>
      )}

      {/* ============================================================ */}
      {/* STEP 2: Stripe card payment                                  */}
      {/* ============================================================ */}
      {step === 'payment' && clientSecret && stripePromise && (
        <div className="space-y-6">
          {/* Order summary (compact) */}
          <Card>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-text-secondary">Order {formatOrderNumber({ id: orderId, display_number: displayNumber })}</p>
                {discount > 0 && (
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

          {/* Payment methods */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={18} className="text-primary" />
              <h2 className="font-semibold text-text">Payment</h2>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 mb-4">
              <ShieldCheck size={14} className="text-green-600 shrink-0" />
              <p className="text-xs text-green-700">
                Secured by Stripe. Your payment details never touch our servers.
              </p>
            </div>

            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
              <StripePaymentForm
                orderId={orderId}
                trackingCode={trackingCode}
                onSuccess={() => completeOrder(trackingCode)}
                onError={(msg) => setError(msg)}
              />
            </Elements>
          </Card>

          {error && (
            <div className="rounded-lg bg-red-50 border border-error/20 p-3 text-sm text-error">{error}</div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Processing state                                             */}
      {/* ============================================================ */}
      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Spinner size="lg" />
          <p className="text-text-secondary">Processing your order...</p>
        </div>
      )}
    </div>
  );
}
