'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCart } from '@/providers/cart-provider';
import {
  fromLocalDateTime,
  validateCart,
} from '@/features/service-period/queries';
import type { UnavailableItem } from '@/features/service-period/types';

const STORAGE_KEY = 'yumyum_pickup';

interface PickupContextValue {
  /** Local wall clock, "YYYY-MM-DDTHH:mm:00", or null for "as soon as possible". */
  pickupTime: string | null;
  /**
   * Items in the cart that are NOT on the menu for the current pickup time.
   * They stay in the cart — this list only drives how they are flagged.
   */
  unavailable: UnavailableItem[];
  /** True while a revalidation round trip is in flight. */
  validating: boolean;
  /**
   * Change the pickup time. The new time is applied immediately (so the menu
   * follows it), then the cart is revalidated against it. Returns the items
   * that are no longer available so the caller can surface them; nothing is
   * removed from the cart here.
   */
  setPickupTime: (next: string | null) => Promise<UnavailableItem[]>;
  /** Re-run validation against the current pickup time (e.g. after editing the cart). */
  revalidate: () => Promise<UnavailableItem[]>;
  /** Dismiss the warning without changing the cart. */
  dismissUnavailable: () => void;
  /** Whether a given cart item is unavailable at the current pickup time. */
  isUnavailable: (itemId: number) => boolean;
}

const PickupContext = createContext<PickupContextValue | null>(null);

export function PickupProvider({ children }: { children: React.ReactNode }) {
  const { items, locationId } = useCart();
  const [pickupTime, setPickupTimeState] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<UnavailableItem[]>([]);
  const [validating, setValidating] = useState(false);

  // Hydrate after mount (SSR-safe). A stored pickup time that has already
  // passed is dropped rather than restored — offering yesterday's slot would
  // fail validation at checkout and confuse the customer.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      if (fromLocalDateTime(saved).getTime() <= Date.now()) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setPickupTimeState(saved);
    } catch {
      // corrupted / unavailable storage — fall back to "as soon as possible"
    }
  }, []);

  useEffect(() => {
    try {
      if (pickupTime) window.localStorage.setItem(STORAGE_KEY, pickupTime);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage full / unavailable
    }
  }, [pickupTime]);

  const cartItemIds = useMemo(
    () => Array.from(new Set(items.map((entry) => entry.item.id))),
    [items],
  );

  const runValidation = useCallback(
    async (when: string | null): Promise<UnavailableItem[]> => {
      if (!locationId || cartItemIds.length === 0) {
        setUnavailable([]);
        return [];
      }
      setValidating(true);
      try {
        const result = await validateCart(locationId, when, cartItemIds);
        setUnavailable(result);
        return result;
      } catch {
        // A closed pickup time makes the endpoint 400. The menu view surfaces
        // that; here we simply have nothing verified to flag, and must not
        // wrongly mark a cart as fine.
        setUnavailable([]);
        return [];
      } finally {
        setValidating(false);
      }
    },
    [locationId, cartItemIds],
  );

  const setPickupTime = useCallback(
    async (next: string | null) => {
      setPickupTimeState(next);
      return runValidation(next);
    },
    [runValidation],
  );

  const revalidate = useCallback(
    () => runValidation(pickupTime),
    [runValidation, pickupTime],
  );

  const dismissUnavailable = useCallback(() => setUnavailable([]), []);

  const isUnavailable = useCallback(
    (itemId: number) => unavailable.some((u) => u.item_id === itemId),
    [unavailable],
  );

  return (
    <PickupContext.Provider
      value={{
        pickupTime,
        unavailable,
        validating,
        setPickupTime,
        revalidate,
        dismissUnavailable,
        isUnavailable,
      }}
    >
      {children}
    </PickupContext.Provider>
  );
}

export function usePickup(): PickupContextValue {
  const ctx = useContext(PickupContext);
  if (!ctx) throw new Error('usePickup must be used within PickupProvider');
  return ctx;
}
