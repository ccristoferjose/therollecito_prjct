import { api } from '@/lib/api/client';
import type {
  BookablePeriod,
  PickupMenuData,
  ServicePeriod,
  UnavailableItem,
} from './types';

/**
 * Pickup times are restaurant-LOCAL wall clock with no offset —
 * "2026-09-12T15:30:00". This matches the contract the backend and the Vite
 * checkout already use. Never send toISOString(): that converts to UTC and
 * would shift the pickup by the timezone offset.
 */
export function toLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

/** Local YYYY-MM-DD, for the bookable-periods query. */
export function toLocalDate(date: Date): string {
  return toLocalDateTime(date).slice(0, 10);
}

/**
 * Parse a datetime coming from either side of the wire.
 *
 * Two shapes reach the client and they must NOT be parsed the same way:
 *
 *   "2026-09-14T07:00:00"       bare wall clock — what we send and persist
 *   "2026-09-14T13:00:00.000Z"  a true UTC instant — what the API returns for
 *                               DATETIME columns (earliest_pickup /
 *                               latest_pickup), because mysql2 turns them into
 *                               Date objects and res.json() emits ISO UTC
 *
 * Splitting on "T" and reading the time literally is correct for the first and
 * badly wrong for the second: it silently shifts every slot by the server's UTC
 * offset (6 hours for CST — breakfast rendered as 1:00 PM). Detect the zone
 * designator and let Date do the conversion when there is one.
 */
export function fromLocalDateTime(value: string): Date {
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) return new Date(value);
  const [datePart, timePart = '00:00:00'] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss || 0);
}

/**
 * Which period/menu applies at a pickup time.
 * Resolves to null when nothing is bookable then — "closed" is a normal
 * answer here, not an error, so the picker can grey the slot out.
 */
export async function resolvePeriod(
  locationId: number,
  pickupTime: string | null,
): Promise<ServicePeriod | null> {
  const qs = pickupTime ? `?pickupTime=${encodeURIComponent(pickupTime)}` : '';
  const res = await api.get<{ period: ServicePeriod | null }>(
    `/service-periods/location/${locationId}/resolve${qs}`,
  );
  return res.period;
}

/** Periods still bookable on a date — drives the pickup picker. */
export async function listBookablePeriods(
  locationId: number,
  date: string,
): Promise<BookablePeriod[]> {
  const res = await api.get<{ periods: BookablePeriod[] }>(
    `/service-periods/location/${locationId}/bookable?date=${encodeURIComponent(date)}`,
  );
  return res.periods;
}

/**
 * Re-check a cart against a pickup time. Returns the items NOT available then.
 * Nothing is removed — the customer decides what to do with them.
 */
export async function validateCart(
  locationId: number,
  pickupTime: string | null,
  itemIds: number[],
): Promise<UnavailableItem[]> {
  const res = await api.post<{ unavailable: UnavailableItem[] }>(
    `/service-periods/location/${locationId}/validate-cart`,
    { pickup_time: pickupTime, item_ids: itemIds },
  );
  return res.unavailable;
}

/**
 * The menu for a location at a pickup time. Throws ApiError(400) when nothing
 * is bookable then, with a message suitable for display.
 */
export async function getMenuForPickup(
  locationId: number,
  pickupTime: string | null,
): Promise<PickupMenuData> {
  const qs = pickupTime ? `?pickupTime=${encodeURIComponent(pickupTime)}` : '';
  return api.get<PickupMenuData>(`/menu/location/${locationId}/pickup${qs}`);
}
