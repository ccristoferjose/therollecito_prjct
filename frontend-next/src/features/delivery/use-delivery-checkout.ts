'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { getDeliveryStatus, requestDeliveryQuote } from '@/features/delivery/queries';
import { validateAddress, type AddressErrors } from '@/features/delivery/validation';
import type {
  AcceptedDeliveryQuote,
  DeliveryAddressInput,
  DeliveryQuote,
  FulfillmentType,
  PriceChange,
} from '@/features/delivery/types';

const STORAGE_KEY = 'yumyum_delivery';

/** Treat a quote as expired this early — matches the backend's safety buffer. */
const EXPIRY_BUFFER_MS = 60_000;

const EMPTY_ADDRESS: DeliveryAddressInput = {
  streetAddress: '',
  apartment: '',
  city: '',
  state: '',
  zipCode: '',
};

export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'available'; quote: DeliveryQuote; locationId: number; pickupTime: string | null }
  | { status: 'unavailable'; message: string };

export function isQuoteExpired(quote: { expiresAt: string } | null | undefined): boolean {
  if (!quote) return true;
  return new Date(quote.expiresAt).getTime() - EXPIRY_BUFFER_MS <= Date.now();
}

function friendlyError(err: unknown): string {
  // The backend already sends customer-safe text for delivery errors; anything
  // else (network, 5xx) gets the generic message.
  if (err instanceof ApiError && err.status < 500 && err.message) return err.message;
  if (err instanceof ApiError && err.code?.startsWith('DELIVERY_')) return err.message;
  return 'Delivery is currently unavailable. Try again or choose Pickup.';
}

interface Persisted {
  mode: FulfillmentType;
  address: DeliveryAddressInput;
  notes: string;
  accepted: AcceptedDeliveryQuote | null;
}

/** How long the "re-checked, no change" confirmation stays visible. */
const RENEW_NOTICE_MS = 8000;

/**
 * Checkout state for the Pickup / Delivery choice.
 *
 * Holds the address form, the quote lifecycle (checking -> available ->
 * accepted) and the expiry handling. The accepted quote is kept in
 * sessionStorage so a refresh mid-checkout does not lose it; it is dropped
 * automatically if the location or pickup time it was priced for changes.
 *
 * Provider quotes are only valid for ~15 minutes. With `autoRefresh` on, the
 * accepted quote is re-checked just before it expires: an unchanged fee renews
 * silently (with a short confirmation), a changed fee surfaces `priceChange`
 * for the customer to accept. The contact phone lives in the checkout form —
 * it is the same number the kitchen and the courier use.
 */
export function useDeliveryCheckout({
  locationId,
  pickupTime,
  subtotal,
  autoRefresh = true,
}: {
  locationId: number | null;
  pickupTime: string | null;
  subtotal: number;
  /** Off once the order exists — the server-side order quote takes over then. */
  autoRefresh?: boolean;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [selectedMode, setModeState] = useState<FulfillmentType>('PICKUP');
  const [address, setAddress] = useState<DeliveryAddressInput>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<AddressErrors>({});
  const [notes, setNotes] = useState('');
  const [rawQuoteState, setQuoteState] = useState<QuoteState>({ status: 'idle' });
  const [rawAccepted, setAccepted] = useState<AcceptedDeliveryQuote | null>(null);
  const [priceChange, setPriceChange] = useState<PriceChange | null>(null);
  const [repricing, setRepricing] = useState(false);
  const [renewNotice, setRenewNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Guards against double submits: a second click while a quote is in flight
  // is ignored rather than firing another provider request.
  const inflight = useRef(false);
  const renewInflight = useRef(false);

  useEffect(() => {
    getDeliveryStatus()
      .then((s) => {
        setAvailable(s.available);
        setMinOrderAmount(Number(s.minOrderAmount) || 0);
      })
      .catch(() => setAvailable(false));
  }, []);

  // Hydrate (SSR-safe).
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved) as Partial<Persisted>;
        if (p.mode === 'DELIVERY' || p.mode === 'PICKUP') setModeState(p.mode);
        if (p.address) setAddress({ ...EMPTY_ADDRESS, ...p.address });
        if (typeof p.notes === 'string') setNotes(p.notes);
        if (p.accepted) setAccepted(p.accepted);
      }
    } catch {
      // corrupted / unavailable storage — start fresh
    }
    setHydrated(true);
  }, []);

  // A quote belongs to one location + pickup time. If either changes, it no
  // longer applies and the customer must check availability again. Derived
  // rather than cleared, so a pickup time that hydrates a tick late does not
  // throw away a perfectly valid quote.
  const matchesContext = (q: { locationId: number; pickupTime: string | null }) =>
    q.locationId === locationId && q.pickupTime === pickupTime;
  const accepted = rawAccepted && matchesContext(rawAccepted) ? rawAccepted : null;
  const quoteState: QuoteState =
    rawQuoteState.status === 'available' && !matchesContext(rawQuoteState) ? { status: 'idle' } : rawQuoteState;

  // Delivery chosen earlier but not offered now: behave as pickup.
  const mode: FulfillmentType = available === false ? 'PICKUP' : selectedMode;

  // Admin-set minimum subtotal for delivery (the server enforces it too).
  const amountShort = Math.max(0, Math.round((minOrderAmount - subtotal) * 100) / 100);
  const belowMinimum = minOrderAmount > 0 && amountShort > 0;

  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: Persisted = { mode: selectedMode, address, notes, accepted: rawAccepted };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full / unavailable
    }
  }, [hydrated, selectedMode, address, notes, rawAccepted]);

  const setMode = useCallback((next: FulfillmentType) => {
    setModeState(next);
    setPriceChange(null);
  }, []);

  const updateAddress = useCallback((field: keyof DeliveryAddressInput, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setAddressErrors((prev) => ({ ...prev, [field]: undefined }));
    // Editing the address invalidates whatever was priced for the old one.
    setQuoteState((prev) => (prev.status === 'idle' ? prev : { status: 'idle' }));
    setAccepted(null);
  }, []);

  const fetchQuote = useCallback(async (): Promise<DeliveryQuote> => {
    if (!locationId) throw new Error('No location selected.');
    return requestDeliveryQuote({ locationId, address, pickupTime, subtotal });
  }, [locationId, address, pickupTime, subtotal]);

  /** "Check delivery availability". Validates first; never double-fires. */
  const checkAvailability = useCallback(async () => {
    if (inflight.current || belowMinimum) return;
    const errors = validateAddress(address);
    setAddressErrors(errors);
    if (Object.keys(errors).length > 0) return;

    inflight.current = true;
    setQuoteState({ status: 'loading' });
    setAccepted(null);
    try {
      const quote = await fetchQuote();
      if (locationId) setQuoteState({ status: 'available', quote, locationId, pickupTime });
    } catch (err) {
      setQuoteState({ status: 'unavailable', message: friendlyError(err) });
    } finally {
      inflight.current = false;
    }
  }, [address, fetchQuote, locationId, pickupTime, belowMinimum]);

  /** "Continue with delivery" — the explicit commitment to the shown price. */
  const acceptQuote = useCallback(() => {
    if (rawQuoteState.status !== 'available' || !locationId) return;
    // Only a quote priced for the current location + pickup time can be accepted.
    if (rawQuoteState.locationId !== locationId || rawQuoteState.pickupTime !== pickupTime) return;
    setAccepted({ ...rawQuoteState.quote, locationId, pickupTime });
  }, [rawQuoteState, locationId, pickupTime]);

  /** "Change address" — back to the form, nothing committed. */
  const changeAddress = useCallback(() => {
    setAccepted(null);
    setPriceChange(null);
    setQuoteState({ status: 'idle' });
  }, []);

  /**
   * Re-price the accepted quote for the same address. Unchanged fee -> the new
   * quote replaces the old one; changed fee -> `priceChange` is set and nothing
   * is committed. Returns the quote to order with, or null when the customer
   * must act first (price changed, or delivery became unavailable).
   */
  const renewQuote = useCallback(
    async ({ force = false }: { force?: boolean } = {}): Promise<AcceptedDeliveryQuote | null> => {
      if (!accepted || !locationId) return null;
      if (!force && !isQuoteExpired(accepted)) return accepted;
      if (renewInflight.current) return null;

      renewInflight.current = true;
      setRepricing(true);
      try {
        const quote = await fetchQuote();
        const renewed: AcceptedDeliveryQuote = { ...quote, locationId, pickupTime };
        if (quote.feeCents === accepted.feeCents) {
          setAccepted(renewed);
          setRenewNotice(`Delivery price re-checked — still ${quote.fee > 0 ? formatCurrency(quote.fee) : 'free'}.`);
          return renewed;
        }
        setPriceChange({ previousFee: accepted.fee, quote });
        return null;
      } catch (err) {
        setAccepted(null);
        setQuoteState({ status: 'unavailable', message: friendlyError(err) });
        return null;
      } finally {
        renewInflight.current = false;
        setRepricing(false);
      }
    },
    [accepted, locationId, pickupTime, fetchQuote],
  );

  /** Called right before the order is created. */
  const ensureFreshQuote = useCallback(() => renewQuote(), [renewQuote]);

  // Re-check the price just before the provider's quote expires, so the
  // customer finds out about a change while still filling in the form — not
  // when they press Place Order. A pending price change pauses the timer.
  useEffect(() => {
    if (!autoRefresh || mode !== 'DELIVERY' || !accepted || priceChange) return;
    const dueIn = new Date(accepted.expiresAt).getTime() - EXPIRY_BUFFER_MS - Date.now();
    const timer = setTimeout(() => {
      void renewQuote({ force: true });
    }, Math.max(0, dueIn));
    return () => clearTimeout(timer);
  }, [autoRefresh, mode, accepted, priceChange, renewQuote]);

  // The "no change" confirmation is transient.
  useEffect(() => {
    if (!renewNotice) return;
    const timer = setTimeout(() => setRenewNotice(null), RENEW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [renewNotice]);

  /** Accept an updated price shown by the "Delivery pricing was updated" card. */
  const acceptPriceChange = useCallback(() => {
    if (!priceChange || !locationId) return;
    setAccepted({ ...priceChange.quote, locationId, pickupTime });
    setQuoteState({ status: 'available', quote: priceChange.quote, locationId, pickupTime });
    setPriceChange(null);
  }, [priceChange, locationId, pickupTime]);

  /** After the order exists, the server is the source of truth for the fee. */
  const replaceAcceptedQuote = useCallback(
    (quote: DeliveryQuote) => {
      if (!locationId) return;
      setAccepted({ ...quote, locationId, pickupTime });
    },
    [locationId, pickupTime],
  );

  const reset = useCallback(() => {
    setAccepted(null);
    setPriceChange(null);
    setQuoteState({ status: 'idle' });
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    available,
    minOrderAmount,
    belowMinimum,
    amountShort,
    mode,
    setMode,
    address,
    addressErrors,
    updateAddress,
    notes,
    setNotes,
    quoteState,
    accepted,
    priceChange,
    setPriceChange,
    repricing,
    setRepricing,
    renewNotice,
    setRenewNotice,
    checkAvailability,
    acceptQuote,
    changeAddress,
    ensureFreshQuote,
    acceptPriceChange,
    replaceAcceptedQuote,
    reset,
  };
}

export type DeliveryCheckout = ReturnType<typeof useDeliveryCheckout>;
