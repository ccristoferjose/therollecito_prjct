'use client';

import { useId, useState } from 'react';
import { Bike, CheckCircle, Info, Save } from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { ApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import { saveDeliverySettings, type DeliverySettings } from '@/features/delivery/queries';

/** Common splits, as customer % of the provider fee. */
const PRESETS = [
  { customer: 100, label: 'Customer pays all' },
  { customer: 75, label: '75 / 25' },
  { customer: 50, label: '50 / 50' },
  { customer: 40, label: '40 / 60' },
  { customer: 0, label: 'Free delivery' },
];

/** Mirrors backend delivery.pricing.js: customer share rounded to the cent. */
function split(feeDollars: number, customerPercent: number) {
  const cents = Math.max(0, Math.round(feeDollars * 100));
  const customer = Math.round((cents * customerPercent) / 100);
  return { customer: customer / 100, restaurant: (cents - customer) / 100 };
}

function SettingsForm({
  initial,
  onSaved,
  justSaved,
  onEdit,
}: {
  initial: DeliverySettings;
  onSaved: () => void;
  /** Owned by the parent: this form remounts after a save, which would lose it. */
  justSaved: boolean;
  onEdit: () => void;
}) {
  const { token } = useStaffAuth();
  const sliderId = useId();
  const [minOrder, setMinOrder] = useState(String(initial.minOrderAmount));
  const [customerPercent, setCustomerPercent] = useState(initial.customerFeePercent);
  const [exampleFee, setExampleFee] = useState('10.99');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minValue = Number(minOrder);
  const minError =
    minOrder.trim() === '' || !Number.isFinite(minValue) || minValue < 0 || minValue > 10000
      ? 'Enter an amount from $0 to $10,000.'
      : undefined;
  const dirty =
    Math.round(minValue * 100) !== Math.round(initial.minOrderAmount * 100) ||
    customerPercent !== initial.customerFeePercent;
  const restaurantPercent = 100 - customerPercent;
  const example = split(Number(exampleFee) || 0, customerPercent);

  function setPercent(next: number) {
    setCustomerPercent(Math.min(100, Math.max(0, Math.round(next))));
    onEdit();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (minError) return;
    setSaving(true);
    setError(null);
    try {
      await saveDeliverySettings({ minOrderAmount: minValue, customerFeePercent: customerPercent }, token);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the delivery settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Minimum order */}
      <Card>
        <h3 className="font-semibold text-text">Minimum order for delivery</h3>
        <p className="mb-4 text-sm text-text-secondary">
          Delivery is only offered when the cart subtotal (before discounts) reaches this amount. Below it,
          customers see how much more they need and can still choose Pickup.
        </p>
        <div className="max-w-xs">
          <Input
            label="Minimum subtotal ($)"
            type="number"
            inputMode="decimal"
            min={0}
            max={10000}
            step="0.01"
            value={minOrder}
            onChange={(e) => {
              setMinOrder(e.target.value);
              onEdit();
            }}
            error={minError}
            hint="Set 0 for no minimum."
            required
          />
        </div>
      </Card>

      {/* Fee split */}
      <Card>
        <h3 className="font-semibold text-text">Who pays the delivery fee</h3>
        <p className="mb-4 text-sm text-text-secondary">
          Split the courier fee between the customer and the restaurant. The restaurant covers whatever the
          customer does not pay.
        </p>

        <div role="group" aria-label="Common splits" className="mb-5 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.customer}
              type="button"
              aria-pressed={customerPercent === p.customer}
              onClick={() => setPercent(p.customer)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                customerPercent === p.customer
                  ? 'border-primary bg-primary text-text-inverse'
                  : 'border-border bg-surface text-text hover:border-primary/40',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label htmlFor={sliderId} className="mb-2 block text-sm font-medium text-text">
          Customer pays <span className="font-bold">{customerPercent}%</span> · Restaurant pays{' '}
          <span className="font-bold">{restaurantPercent}%</span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={5}
          value={customerPercent}
          onChange={(e) => setPercent(Number(e.target.value))}
          aria-valuetext={`Customer ${customerPercent} percent, restaurant ${restaurantPercent} percent`}
          className="w-full accent-[var(--color-primary)]"
        />

        {/* Visual split */}
        <div aria-hidden="true" className="mt-3 flex h-8 overflow-hidden rounded-lg text-xs font-bold">
          {customerPercent > 0 && (
            <div
              className="flex items-center justify-center bg-primary text-text-inverse transition-all"
              style={{ width: `${customerPercent}%` }}
            >
              {customerPercent >= 15 && `Customer ${customerPercent}%`}
            </div>
          )}
          {restaurantPercent > 0 && (
            <div
              className="flex items-center justify-center bg-accent text-primary-dark transition-all"
              style={{ width: `${restaurantPercent}%` }}
            >
              {restaurantPercent >= 15 && `Restaurant ${restaurantPercent}%`}
            </div>
          )}
        </div>

        <div className="mt-2 max-w-[10rem]">
          <Input
            label="Exact customer %"
            type="number"
            min={0}
            max={100}
            step="1"
            value={customerPercent}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
        </div>

        {/* Worked example */}
        <div className="mt-5 rounded-xl border border-border bg-primary-light/20 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <Input
                label="Example courier fee ($)"
                type="number"
                min={0}
                step="0.01"
                value={exampleFee}
                onChange={(e) => setExampleFee(e.target.value)}
              />
            </div>
            <p className="pb-2 text-sm text-text">
              Customer pays{' '}
              <strong>{example.customer > 0 ? formatCurrency(example.customer) : 'nothing (Free delivery)'}</strong>
              {' · '}restaurant covers <strong>{formatCurrency(example.restaurant)}</strong>
            </p>
          </div>
        </div>
      </Card>

      <p className="flex items-start gap-2 text-xs text-text-secondary">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Changes apply to new delivery quotes. A price a customer has already accepted is kept; if their quote is
        re-checked after this change, they are shown the new price and asked to accept it.
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-error/20 bg-red-50 p-3 text-sm text-error-text">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={saving || !dirty || !!minError}>
          {saving ? <Spinner size="sm" decorative /> : <Save size={16} aria-hidden="true" />} Save settings
        </Button>
        {justSaved && !dirty && (
          <span role="status" className="flex items-center gap-1.5 text-sm text-green-700">
            <CheckCircle size={16} aria-hidden="true" /> Saved
          </span>
        )}
        {initial.updatedAt && (
          <span className="text-xs text-text-secondary">
            Last changed {new Date(initial.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            {initial.updatedByName ? ` by ${initial.updatedByName}` : ''}
          </span>
        )}
      </div>
    </form>
  );
}

/** Admin › Delivery: global minimum order and customer/restaurant fee split. */
export default function DeliverySettingsPage() {
  const { token } = useStaffAuth();
  const { data, loading, error, refetch } = useFetch<DeliverySettings>('/delivery/settings', token);
  const [justSaved, setJustSaved] = useState(false);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-text">
          <Bike size={20} className="text-primary" aria-hidden="true" /> Delivery
        </h2>
        <p className="text-sm text-text-secondary">Pricing rules for courier delivery. Applies to every location.</p>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error || !data ? (
        <div role="alert" className="rounded-lg border border-error/20 bg-red-50 p-3 text-sm text-error-text">
          Could not load the delivery settings.
        </div>
      ) : (
        // Keyed on the saved version, so a save resets the form to what the
        // server stored without syncing state in an effect.
        <SettingsForm
          key={data.updatedAt ?? 'initial'}
          initial={data}
          justSaved={justSaved}
          onSaved={() => {
            setJustSaved(true);
            refetch();
          }}
          onEdit={() => setJustSaved(false)}
        />
      )}
    </div>
  );
}
