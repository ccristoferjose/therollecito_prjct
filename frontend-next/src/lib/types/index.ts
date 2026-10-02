/**
 * Shared domain types / API contracts. These mirror the shapes returned by the
 * Express backend and are the single source of truth for the frontend.
 */

export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  is_active?: number | boolean;
}

/** A staff account as returned by GET /users/staff. */
export interface StaffMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role_name: string;
  location_id?: number | null;
  location_name?: string | null;
  is_active: number | boolean;
  created_at: string;
}

export interface Promotion {
  id: number;
  code: string;
  description?: string | null;
  discount_type: 'percentage' | 'fixed' | string;
  discount_value: number;
  min_order?: number | null;
  max_uses?: number | null;
  current_uses: number;
  starts_at: string;
  expires_at?: string | null;
  is_active: number | boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_active?: number | boolean;
  category_id?: number;
}

export interface MenuCategory {
  id: number;
  name: string;
  sort_order?: number;
}

/** Flat option/value lists as returned by /menu/location/:id. */
export interface MenuItemOption {
  id: number;
  item_id: number;
  name: string;
  is_required?: number | boolean;
}

export interface MenuItemOptionValue {
  id: number;
  item_option_id: number;
  name: string;
  price_modifier: number;
}

export interface MenuData {
  items: MenuItem[];
  categories?: MenuCategory[];
  options?: MenuItemOption[];
  optionValues?: MenuItemOptionValue[];
}

export type OrderStatus =
  | 'CREATED'
  | 'PAID'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELED';

export interface Order {
  id: number;
  status_name: OrderStatus | string;
  location_id?: number;
  location_name?: string;
  total_amount: number;
  subtotal?: number;
  discount_amount?: number;
  processing_fee?: number;
  /** PICKUP unless the customer chose delivery. */
  fulfillment_type?: 'PICKUP' | 'DELIVERY';
  /** Customer-facing delivery fee — its own line, never folded into subtotal. */
  delivery_fee?: number;
  /** Courier lifecycle (tracking endpoint only; null for pickup orders). */
  delivery_status?: string | null;
  delivery_tracking_url?: string | null;
  delivery_pickup_eta?: string | null;
  delivery_dropoff_eta?: string | null;
  delivery_street_address?: string | null;
  delivery_apartment?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_zip_code?: string | null;
  delivery_undeliverable_reason?: string | null;
  /** Courier snapshot from provider webhooks (no phone / live location stored). */
  courier_name?: string | null;
  courier_image_url?: string | null;
  courier_vehicle?: string | null;
  courier_vehicle_type?: string | null;
  courier_license_plate?: string | null;
  courier_rating?: number | null;
  /** Provider says the courier is about to arrive (at the bakery or the door). */
  courier_imminent?: number | boolean | null;
  tracking_code?: string;
  display_number?: number;
  guest_name?: string | null;
  guest_phone?: string | null;
  pickup_time?: string | null;
  created_at?: string;
}

export interface OrderItemOption {
  id: number;
  order_item_id: number;
  item_option_value_id?: number;
  option_name?: string;
  option_value_name: string;
  price_modifier?: number;
}

export interface OrderItem {
  id: number;
  item_id?: number;
  item_name: string;
  unit_price: number;
  quantity: number;
  notes?: string | null;
  options?: OrderItemOption[];
}

/** Response shape of GET /orders/:id/items. */
export interface OrderItemsResponse {
  items: OrderItem[];
  itemOptions: OrderItemOption[];
}
