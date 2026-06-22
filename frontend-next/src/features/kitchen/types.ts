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
