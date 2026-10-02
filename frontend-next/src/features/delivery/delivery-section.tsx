'use client';

import { useId } from 'react';
import { AlertTriangle, Bike, CheckCircle, MapPin, RefreshCw, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatTime } from '@/lib/utils/format';
import { US_STATES } from '@/features/delivery/validation';
import type { DeliveryCheckout } from '@/features/delivery/use-delivery-checkout';
import type { DeliveryQuote, FulfillmentType, PriceChange } from '@/features/delivery/types';

/** "$0.00" reads like an error; a fully covered delivery is "Free". */
export function formatDeliveryFee(fee: number): string {
  return fee > 0 ? formatCurrency(fee) : 'Free';
}

/** "45–60 min" from the provider's total duration. */
export function etaRange(quote: Pick<DeliveryQuote, 'durationMinutes'>): string | null {
  const d = quote.durationMinutes;
  if (!d || d <= 0) return null;
  const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  const high = round5(d);
  const low = round5(d - 15);
  return low < high ? `${low}–${high} min` : `${high} min`;
}

export function AddressLines({ address }: { address: DeliveryQuote['address'] }) {
  return (
    <>
      <span className="block">
        {address.streetAddress}
        {address.apartment ? `, ${address.apartment}` : ''}
      </span>
      <span className="block">
        {address.city}, {address.state} {address.zipCode}
      </span>
    </>
  );
}

// --------------------------------------------------------------------------
// Pickup / Delivery choice
// --------------------------------------------------------------------------

/**
 * Segmented Pickup / Delivery control. Labelled by the step heading the page
 * renders (`labelledBy`), so the question is not read twice.
 */
export function FulfillmentSelector({
  value,
  onChange,
  labelledBy,
  minOrderAmount = 0,
}: {
  value: FulfillmentType;
  onChange: (next: FulfillmentType) => void;
  labelledBy: string;
  /** Shown on the Delivery option so the minimum is known before choosing. */
  minOrderAmount?: number;
}) {
  const name = useId();
  const options = [
    { value: 'PICKUP' as const, label: 'Pickup', hint: 'Collect it at the bakery', icon: Store },
    {
      value: 'DELIVERY' as const,
      label: 'Delivery',
      hint: minOrderAmount > 0 ? `Orders of ${formatCurrency(minOrderAmount)}+` : 'A courier brings it to you',
      icon: Bike,
    },
  ];
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40',
              selected ? 'border-primary bg-primary-light/30' : 'border-border bg-surface hover:border-primary/40',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <Icon size={20} className={selected ? 'text-primary' : 'text-text-secondary'} aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-text">{opt.label}</span>
              <span className="block text-xs text-text-secondary">{opt.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Address form
// --------------------------------------------------------------------------
function AddressForm({ delivery }: { delivery: DeliveryCheckout }) {
  const stateId = useId();
  const { address, addressErrors, updateAddress, quoteState, checkAvailability } = delivery;
  const loading = quoteState.status === 'loading';

  return (
    <div className="space-y-4">
      {/* autoComplete tokens let the browser / password manager fill the whole
          address in one go (WCAG 1.3.5). Latitude/longitude are never asked for:
          the server geocodes the address. */}
      <Input
        label="Street address"
        autoComplete="address-line1"
        value={address.streetAddress}
        onChange={(e) => updateAddress('streetAddress', e.target.value)}
        error={addressErrors.streetAddress}
        placeholder="1920 E El Segundo Blvd"
        required
      />
      <Input
        label="Apartment / Unit (optional)"
        autoComplete="address-line2"
        value={address.apartment}
        onChange={(e) => updateAddress('apartment', e.target.value)}
        error={addressErrors.apartment}
        placeholder="Apt 4B"
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem_8rem]">
        <Input
          label="City"
          autoComplete="address-level2"
          value={address.city}
          onChange={(e) => updateAddress('city', e.target.value)}
          error={addressErrors.city}
          required
        />
        <div className="space-y-1">
          <label htmlFor={stateId} className="block text-sm font-medium text-text">
            State
          </label>
          <select
            id={stateId}
            autoComplete="address-level1"
            value={address.state}
            onChange={(e) => updateAddress('state', e.target.value)}
            aria-invalid={addressErrors.state ? true : undefined}
            aria-describedby={addressErrors.state ? `${stateId}-error` : undefined}
            required
            className={cn(
              'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
              addressErrors.state && 'border-error',
            )}
          >
            <option value="">—</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {addressErrors.state && (
            <p id={`${stateId}-error`} className="text-xs text-error-text">
              {addressErrors.state}
            </p>
          )}
        </div>
        <Input
          label="ZIP Code"
          autoComplete="postal-code"
          inputMode="numeric"
          value={address.zipCode}
          onChange={(e) => updateAddress('zipCode', e.target.value)}
          error={addressErrors.zipCode}
          required
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={checkAvailability}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <Spinner size="sm" decorative /> Checking delivery availability...
          </>
        ) : (
          <>
            <MapPin size={16} aria-hidden="true" /> Check delivery availability
          </>
        )}
      </Button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Quote display
// --------------------------------------------------------------------------
function QuoteSummary({ quote }: { quote: DeliveryQuote }) {
  const eta = etaRange(quote);
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-text-secondary">Estimated delivery</dt>
        <dd className="font-semibold text-text">
          {eta ?? '—'}
          {quote.estimatedDeliveryAt && (
            <span className="block text-xs font-normal text-text-secondary">
              arrives around {formatTime(quote.estimatedDeliveryAt)}
            </span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-text-secondary">Delivery fee</dt>
        <dd className={cn('font-semibold', quote.fee > 0 ? 'text-text' : 'text-green-700')}>
          {formatDeliveryFee(quote.fee)}
        </dd>
      </div>
      <div>
        <dt className="text-text-secondary">Deliver to</dt>
        <dd className="font-medium text-text">
          <AddressLines address={quote.address} />
        </dd>
      </div>
    </dl>
  );
}

/** "Delivery pricing was updated" — the customer must accept a changed fee. */
export function PriceChangeCard({
  change,
  onAccept,
  onCancel,
  busy,
}: {
  change: PriceChange;
  onAccept: () => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const went = change.quote.fee > change.previousFee ? 'went up' : 'went down';
  return (
    <div role="alert" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-amber-900">
        <RefreshCw size={16} aria-hidden="true" /> Delivery pricing was updated.
      </p>
      <p className="mt-1 text-xs text-amber-900">
        Delivery prices are only held for a few minutes. We re-checked it and the fee {went}.
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm text-amber-900">
        <dt>Previous:</dt>
        <dd className="line-through">{formatDeliveryFee(change.previousFee)}</dd>
        <dt>Current:</dt>
        <dd className="font-semibold">{formatDeliveryFee(change.quote.fee)}</dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="accent" size="sm" onClick={onAccept} disabled={busy}>
          {busy ? <Spinner size="sm" decorative /> : <CheckCircle size={14} aria-hidden="true" />} Accept updated delivery
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Choose Pickup instead
          </Button>
        )}
      </div>
    </div>
  );
}

/** "Price held until 8:52 PM" — and what happens after, so the re-check is expected. */
export function PriceHold({ delivery }: { delivery: DeliveryCheckout }) {
  const { accepted, renewNotice, repricing, priceChange } = delivery;
  // The old price is no longer held once a change is waiting for the customer.
  if (!accepted || priceChange) return null;
  if (repricing) {
    return (
      <div role="status" className="flex items-center gap-2 text-xs text-text-secondary">
        <Spinner size="sm" decorative /> Updating delivery price...
      </div>
    );
  }
  return (
    <p role="status" className="flex items-center gap-1.5 text-xs text-text-secondary">
      <ShieldCheck size={13} className="shrink-0 text-green-700" aria-hidden="true" />
      {renewNotice ?? (
        <>
          Price held until {formatTime(accepted.expiresAt)} &middot; we&apos;ll re-check it automatically.
        </>
      )}
    </p>
  );
}

// --------------------------------------------------------------------------
// Address + quote panel (lives inside the checkout's "Your details" step)
// --------------------------------------------------------------------------
export default function DeliveryAddressPanel({ delivery }: { delivery: DeliveryCheckout }) {
  const { quoteState, accepted, priceChange, setMode } = delivery;

  // Below the admin-set minimum: say how much is missing instead of asking
  // for an address that could not be delivered to anyway.
  if (delivery.belowMinimum) {
    return (
      <div role="status" className="rounded-xl border border-primary/30 bg-primary-light/20 p-4">
        <p className="flex items-center gap-2 font-semibold text-primary-dark">
          <ShoppingBag size={16} aria-hidden="true" /> Add {formatCurrency(delivery.amountShort)} more for delivery
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Delivery is available for orders of {formatCurrency(delivery.minOrderAmount)} or more.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/order" className="inline-flex items-center rounded-full border-2 border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-primary-dark hover:text-text-inverse">
            Add more items
          </Link>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('PICKUP')}>
            Choose Pickup instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {priceChange && (
        <PriceChangeCard
          change={priceChange}
          onAccept={delivery.acceptPriceChange}
          onCancel={() => setMode('PICKUP')}
        />
      )}

      {accepted ? (
        // Committed: compact summary with a way back.
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-800">
            <CheckCircle size={16} aria-hidden="true" /> Delivery selected
          </p>
          <QuoteSummary quote={accepted} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <PriceHold delivery={delivery} />
            <Button type="button" variant="ghost" size="sm" onClick={delivery.changeAddress}>
              Change address
            </Button>
          </div>
        </div>
      ) : quoteState.status === 'available' ? (
        <div className="rounded-xl border border-primary/30 bg-primary-light/20 p-4">
          <p className="mb-3 flex items-center gap-2 font-semibold text-primary-dark">
            <CheckCircle size={16} className="text-success" aria-hidden="true" /> Delivery available
          </p>
          <QuoteSummary quote={quoteState.quote} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={delivery.changeAddress}>
              Change address
            </Button>
            <Button type="button" variant="accent" size="sm" onClick={delivery.acceptQuote}>
              <Bike size={14} aria-hidden="true" /> Continue with delivery
            </Button>
          </div>
        </div>
      ) : (
        <>
          {quoteState.status === 'unavailable' && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-error/30 bg-red-50 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold text-error-text">Delivery unavailable</p>
                <p className="text-text-secondary">{quoteState.message}</p>
              </div>
            </div>
          )}
          <AddressForm delivery={delivery} />
        </>
      )}
    </div>
  );
}
