export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
