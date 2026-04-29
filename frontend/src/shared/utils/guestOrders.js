const STORAGE_KEY = 'yumyum_guest_orders';

/**
 * Guest order storage — saves tracking codes in localStorage
 * so guest users can see their recent orders without an account.
 */

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function save(orders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // storage full
  }
}

export function addGuestOrder(trackingCode) {
  const orders = load();
  // Avoid duplicates
  if (orders.find((o) => o.trackingCode === trackingCode)) return;
  orders.unshift({ trackingCode, createdAt: Date.now() });
  // Keep only last 10 orders
  save(orders.slice(0, 10));
}

export function getGuestOrders() {
  return load();
}

export function removeGuestOrder(trackingCode) {
  const orders = load().filter((o) => o.trackingCode !== trackingCode);
  save(orders);
}

export function clearCompletedGuestOrders(completedCodes) {
  const orders = load().filter((o) => !completedCodes.includes(o.trackingCode));
  save(orders);
}
