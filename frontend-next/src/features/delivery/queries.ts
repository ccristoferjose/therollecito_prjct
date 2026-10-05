import { api } from '@/lib/api/client';
import type {
  DeliveryAddressInput,
  DeliveryQuote,
  OrderTotals,
  RefreshQuoteResponse,
} from '@/features/delivery/types';

/** Whether checkout should offer Delivery at all, and from what subtotal. */
export function getDeliveryStatus(): Promise<{ available: boolean; minOrderAmount: number }> {
  return api.get('/delivery/status');
}

export type FeeSplitMode = 'PERCENT' | 'FLAT';

/** Admin: delivery pricing settings. */
export interface DeliverySettings {
  minOrderAmount: number;
  /** PERCENT: customer pays customerFeePercent. FLAT: restaurant covers restaurantFlatAmount. */
  feeSplitMode: FeeSplitMode;
  /** Share of the provider fee the customer pays; the restaurant covers the rest. */
  customerFeePercent: number;
  restaurantFeePercent: number;
  /** Dollars of the provider fee the restaurant covers (FLAT mode). */
  restaurantFlatAmount: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export function getDeliverySettings(token: string | null): Promise<DeliverySettings> {
  return api.get('/delivery/settings', token);
}

export function saveDeliverySettings(
  settings: {
    minOrderAmount: number;
    feeSplitMode: FeeSplitMode;
    customerFeePercent: number;
    restaurantFlatAmount: number;
  },
  token: string | null,
): Promise<DeliverySettings> {
  return api.put(
    '/delivery/settings',
    {
      min_order_amount: settings.minOrderAmount,
      fee_split_mode: settings.feeSplitMode,
      customer_fee_percent: settings.customerFeePercent,
      restaurant_flat_amount: settings.restaurantFlatAmount,
    },
    token,
  );
}

/**
 * Price a delivery. Only the dropoff is sent — the restaurant's address and
 * coordinates are resolved by the backend from the selected location.
 */
export function requestDeliveryQuote(params: {
  locationId: number;
  address: DeliveryAddressInput;
  pickupTime: string | null;
  subtotal: number;
}): Promise<DeliveryQuote> {
  return api.post('/delivery/quote', {
    location_id: params.locationId,
    address: {
      street_address: params.address.streetAddress.trim(),
      apartment: params.address.apartment.trim() || null,
      city: params.address.city.trim(),
      state: params.address.state.trim().toUpperCase(),
      zip_code: params.address.zipCode.trim(),
    },
    pickup_time: params.pickupTime,
    subtotal: Math.round(params.subtotal * 100) / 100,
  });
}

/** Before payment: keep, silently renew, or re-price the order's quote. */
export function refreshOrderQuote(orderId: number): Promise<RefreshQuoteResponse> {
  return api.post(`/delivery/orders/${orderId}/refresh-quote`);
}

/** The customer explicitly accepted an updated delivery price. */
export function acceptOrderQuote(
  orderId: number,
  quoteId: string,
): Promise<{ quote: DeliveryQuote; totals: OrderTotals }> {
  return api.post(`/delivery/orders/${orderId}/accept-quote`, { quote_id: quoteId });
}
