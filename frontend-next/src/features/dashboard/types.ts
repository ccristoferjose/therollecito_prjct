export interface DashboardKpis {
  today_revenue: number;
  today_orders: number;
  avg_order_value: number;
  active_orders: number;
  revenue_delta_pct: number;
  orders_delta_pct: number;
}
export interface DashboardLifetime {
  revenue: number;
  orders: number;
  avg_daily_30d: number;
}
export interface DashboardCounts {
  active_locations: number;
  total_locations: number;
  total_users: number;
}
export interface DashboardLocationRow {
  id: number;
  name: string;
  city: string;
  today_revenue: number;
  today_orders: number;
  week_revenue: number;
  week_orders: number;
  month_revenue: number;
  month_orders: number;
}
export interface DashboardRecentOrder {
  id: number;
  display_number?: number;
  guest_name?: string | null;
  location_name?: string;
  status_name: string;
  total_amount: number;
  created_at: string;
  is_priority?: number | boolean;
}
export interface DashboardOverview {
  kpis: DashboardKpis;
  lifetime: DashboardLifetime;
  counts: DashboardCounts;
  locations: DashboardLocationRow[];
  recent_orders: DashboardRecentOrder[];
}
export interface RevenuePoint {
  day: string;
  revenue: number | string;
  order_count: number | string;
}
