/** A client-role user with order aggregates, from sp_client_list. */
export interface Client {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  firebase_uid: string | null;
  is_active: number | boolean;
  created_at: string;
  order_count: number;
  /** Excludes CREATED/CANCELED orders — abandoned checkouts don't count. */
  total_spent: number | string;
  last_order_at: string | null;
}

/** One row of a client's order history. */
export interface ClientOrder {
  id: number;
  display_number?: number;
  status_name: string;
  location_name?: string;
  total_amount: number | string;
  tracking_code?: string | null;
  created_at: string;
}

export interface ClientOrdersResponse {
  client: Client;
  orders: ClientOrder[];
}
