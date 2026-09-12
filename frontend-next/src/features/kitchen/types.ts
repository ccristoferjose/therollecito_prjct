import type { ComponentType } from 'react';
import type { OrderItem } from '@/lib/types';

export interface KitchenOrder {
  id: number;
  display_number?: number;
  created_at: string;
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
