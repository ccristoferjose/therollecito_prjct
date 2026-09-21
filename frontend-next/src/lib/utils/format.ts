export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(dateString: string): string {
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
export function formatOrderNumber(
  order: { display_number?: number | null; id: number } | null | undefined,
): string {
  if (!order) return '';
  const n = order.display_number && order.display_number > 0 ? order.display_number : order.id;
  return `#${String(n).padStart(3, '0')}`;
}

export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Day-aware time label: "Today at 10:00 AM", "Tomorrow at 9:00 AM",
 * "Fri, Sep 25 at 9:00 AM".
 *
 * The kitchen board shows scheduled orders alongside live ones, so a bare
 * "10:00 AM" is ambiguous — staff cannot tell today's rush from tomorrow's
 * pre-order. `relativeTo` is the clock to compare against (the server-corrected
 * one on the board, so a drifted tablet doesn't mislabel a day boundary).
 */
export function formatWhen(dateString: string, relativeTo: number = Date.now()): string {
  const date = new Date(dateString);
  const time = formatTime(dateString);

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(new Date(relativeTo))) / 86_400_000);

  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Tomorrow at ${time}`;
  if (days === -1) return `Yesterday at ${time}`;

  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} at ${time}`;
}
