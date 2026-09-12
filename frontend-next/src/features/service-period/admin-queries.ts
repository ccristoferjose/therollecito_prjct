import { api } from '@/lib/api/client';
import type { ServicePeriodAdminResponse } from './types';

/**
 * Admin service-period calls. Kept apart from queries.ts (the public
 * pickup-flow calls) because every function here requires a staff token and an
 * admin/manager role.
 *
 * The server validates the rules these screens rely on — overlapping windows at
 * a location, end_time <= start_time, unknown menus — and raises them as
 * SQLSTATE 45000, which the API surfaces as a 400 with a readable message. The
 * UI shows that message rather than duplicating the rules.
 */

export function listPeriods(locationId: number, token: string | null) {
  return api.get<ServicePeriodAdminResponse>(`/service-periods/location/${locationId}`, token);
}

export function createPeriod(
  body: {
    location_id: number;
    menu_id: number;
    name: string;
    prep_time_minutes?: number;
    sort_order?: number;
  },
  token: string | null,
) {
  return api.post<{ id: number }>('/service-periods', body, token);
}

export function updatePeriod(
  id: number,
  body: {
    menu_id?: number;
    name?: string;
    prep_time_minutes?: number;
    sort_order?: number;
    is_active?: boolean;
  },
  token: string | null,
) {
  return api.patch<null>(`/service-periods/${id}`, body, token);
}

/** Upsert one weekday's hours. Times are HH:MM or HH:MM:SS. */
export function setSchedule(
  id: number,
  body: { day_of_week: number; start_time: string; end_time: string },
  token: string | null,
) {
  return api.put<null>(`/service-periods/${id}/schedule`, body, token);
}

/** Removing a weekday's row is how a period is marked closed that day. */
export function clearSchedule(id: number, dayOfWeek: number, token: string | null) {
  return api.delete<null>(`/service-periods/${id}/schedule/${dayOfWeek}`, token);
}

/**
 * Deletes only when no order references the period; otherwise the server
 * deactivates it so historical orders keep resolving. The result says which
 * happened.
 */
export function removePeriod(id: number, token: string | null) {
  return api.delete<{ result: 'deleted' | 'deactivated' | null }>(
    `/service-periods/${id}`,
    token,
  );
}
