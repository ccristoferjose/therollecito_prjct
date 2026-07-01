export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// The restaurant operates on Pacific time (California). Pin every date/time
// render to this zone so all devices — kitchen iPad, admin laptop, a customer
// phone in another state — show the same wall-clock regardless of the device's
// own system timezone. Change this one constant if the business relocates.
export const RESTAURANT_TZ = 'America/Los_Angeles';

/**
 * Wall-clock parts (year/month/day/hour/minute) of an instant AS SEEN in the
 * restaurant's timezone — independent of the device's own timezone. Checkout
 * uses this so a customer ordering from anywhere schedules pickups against the
 * store's local clock, not their phone's.
 */
export function restaurantParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RESTAURANT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  let hour = Number(p.hour);
  if (hour === 24) hour = 0; // some engines emit '24' for midnight
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour,
    minute: Number(p.minute),
  };
}

export function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: RESTAURANT_TZ,
  });
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: RESTAURANT_TZ,
  });
}

/**
 * Human-friendly short order number — the per-location daily counter
 * zero-padded to 3 digits (#001, #042, #999). Falls back to the raw
 * database id if display_number isn't present (legacy rows).
 */
export function formatOrderNumber(order) {
  if (!order) return '';
  const n = order.display_number && order.display_number > 0
    ? order.display_number
    : order.id;
  return `#${String(n).padStart(3, '0')}`;
}

export function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
