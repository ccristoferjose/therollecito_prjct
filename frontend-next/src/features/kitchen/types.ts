import type { ComponentType } from 'react';
import type { OrderItem } from '@/lib/types';

/**
 * Where an order sits in the kitchen workflow. Derived from `prepare_at` at
 * query time — these are NOT database statuses. A PAID order moves
 * SCHEDULED -> LATER_TODAY -> UPCOMING -> QUEUE purely because NOW() advances.
 */
export type KitchenBucket = 'QUEUE' | 'UPCOMING' | 'PREPARING' | 'READY';

export interface KitchenOrder {
  id: number;
  display_number?: number;
  created_at: string;

  /** Derived bucket from the board endpoint. */
  bucket?: KitchenBucket;
  /** pickup_time minus the service period's prep lead time (created_at for ASAP orders). */
  prepare_at?: string;
  is_priority?: number | boolean;
  priority_reason?: string | null;
  payment_status?: string | null;
  guest_name?: string | null;
  pickup_time?: string | null;
  total_amount: number;
  items?: OrderItem[];

  /**
   * ORDER-LEVEL special instructions from checkout — distinct from the
   * per-item notes on OrderItem. sp_order_list_by_location has always returned
   * this, but the board dropped it, so a customer note like a gate code or an
   * allergy warning never reached the kitchen screen.
   */
  notes?: string | null;

  /** Contact details, so the kitchen can reach the customer about an order. */
  guest_phone?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
}

export interface KitchenColumn {
  status: 'PAID' | 'PREPARING' | 'READY';
  label: string;
  icon: ComponentType<{ size?: number }>;
  nextStatus: string;
  nextAction: string;
  nextIcon: ComponentType<{ size?: number }>;
  headerBg: string;
  headerText: string;
  accent: string;
  dot: string;
}

/**
 * Reference-only rows for the collapsed "Later today" section. The kitchen
 * cannot act on these yet, so the board deliberately does not load their items.
 */
export interface LaterTodayOrder {
  id: number;
  display_number?: number;
  guest_name?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
  total_amount: number;
  pickup_time?: string | null;
  created_at: string;
  notes?: string | null;
  prepare_at: string;
  item_count: number;
}

/** Response shape of GET /kitchen/board. */
export interface KitchenBoardResponse {
  queue: KitchenOrder[];
  upcoming: KitchenOrder[];
  preparing: KitchenOrder[];
  ready: KitchenOrder[];
  later_today: LaterTodayOrder[];
  scheduled_count: number;
  upcoming_window_minutes: number;
  /** Server clock at response time — the board re-buckets against this, not the tablet's clock. */
  server_time: string;
}

/** A future-dated order on the Scheduled page. */
export interface ScheduledOrder extends KitchenOrder {
  prepare_at: string;
  prepare_date: string;
  status_name: string;
}

/** Response shape of GET /kitchen/scheduled. */
export interface ScheduledResponse {
  orders: ScheduledOrder[];
  server_time: string;
}

export interface HistoryOrder {
  id: number;
  display_number?: number;
  guest_name?: string | null;
  guest_phone?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
  user_email?: string | null;
  status_name: string;
  payment_status?: string | null;
  total_amount: number;
  created_at: string;
}
