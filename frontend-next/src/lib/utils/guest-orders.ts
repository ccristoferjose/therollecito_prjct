const STORAGE_KEY = 'yumyum_guest_orders';

/**
 * Guest order storage — saves tracking codes in localStorage so guest users
 * can see their recent orders without an account. SSR-safe: every access is
 * guarded, so calling these during server render is a no-op.
 */
export interface GuestOrder {
  trackingCode: string;
  createdAt: number;
}

function load(): GuestOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as GuestOrder[]) : [];
  } catch {
    return [];
  }
}

function save(orders: GuestOrder[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // storage full / unavailable
  }
}

export function addGuestOrder(trackingCode: string): void {
  const orders = load();
  if (orders.find((o) => o.trackingCode === trackingCode)) return;
  orders.unshift({ trackingCode, createdAt: Date.now() });
  save(orders.slice(0, 10));
}

export function getGuestOrders(): GuestOrder[] {
  return load();
}

export function removeGuestOrder(trackingCode: string): void {
  save(load().filter((o) => o.trackingCode !== trackingCode));
}

export function clearCompletedGuestOrders(completedCodes: string[]): void {
  save(load().filter((o) => !completedCodes.includes(o.trackingCode)));
}
