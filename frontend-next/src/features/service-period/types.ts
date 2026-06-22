import type { MenuData } from '@/lib/types';

/** A resolved service period — which menu applies at a given pickup time. */
export interface ServicePeriod {
  id: number;
  name: string;
  menu_id: number;
  prep_time_minutes: number;
  /** MySQL DAYOFWEEK(): 1 = Sunday .. 7 = Saturday. */
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  earliest_pickup?: string;
  menu_name?: string;
}

/** A period still bookable on a date, with its valid pickup window. */
export interface BookablePeriod {
  id: number;
  name: string;
  menu_id: number;
  prep_time_minutes: number;
  start_time: string;
  end_time: string;
  /** Clamped to now + prep_time_minutes when the window is already in progress. */
  earliest_pickup: string;
  latest_pickup: string;
}

/** An item in the cart that is not on the menu for the selected pickup time. */
export interface UnavailableItem {
  item_id: number;
  item_name: string;
}

/** Menu payload for a pickup time — MenuData plus the period that resolved. */
export interface PickupMenuData extends MenuData {
  period: ServicePeriod | null;
}

// --- Admin ------------------------------------------------------------------

/** A service period as returned by the admin list endpoint. */
export interface AdminServicePeriod {
  id: number;
  location_id: number;
  menu_id: number;
  menu_name: string;
  name: string;
  prep_time_minutes: number;
  sort_order: number;
  is_active: number | boolean;
  created_at: string;
}

/**
 * One weekday's hours for a period. day_of_week follows MySQL DAYOFWEEK():
 * 1 = Sunday .. 7 = Saturday. No row for a day means CLOSED that day.
 */
export interface ServicePeriodSchedule {
  id: number;
  service_period_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface ServicePeriodAdminResponse {
  periods: AdminServicePeriod[];
  schedules: ServicePeriodSchedule[];
}

/** Minimal menu shape for the period's menu selector. */
export interface MenuSummary {
  id: number;
  name: string;
  is_active: number | boolean;
}
