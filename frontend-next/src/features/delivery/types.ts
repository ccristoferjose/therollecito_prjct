/**
 * Delivery contracts. These mirror /api/delivery responses. The provider (Uber)
 * is invisible here on purpose: the frontend only ever sees normalized shapes.
 */

export type FulfillmentType = 'PICKUP' | 'DELIVERY';

/** What the customer types. Coordinates are resolved server-side, never entered. */
export interface DeliveryAddressInput {
  streetAddress: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface DeliveryAddress {
  streetAddress: string;
  apartment?: string | null;
  city: string;
  state: string;
  zipCode: string;
  country: 'US';
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryQuote {
  quoteId: string;
  /** Customer delivery fee in dollars (feeCents is the same amount in cents). */
  fee: number;
  feeCents: number;
  currency: string;
  durationMinutes: number | null;
  pickupDurationMinutes: number | null;
  estimatedDeliveryAt: string | null;
  expiresAt: string;
  pickupReadyAt: string | null;
  address: DeliveryAddress;
  formattedAddress?: string | null;
}

/** A quote plus the checkout context it was priced for. */
export interface AcceptedDeliveryQuote extends DeliveryQuote {
  locationId: number;
  /** Pickup time the quote was priced for (null = ASAP). */
  pickupTime: string | null;
}

export interface OrderTotals {
  subtotal_amount: number;
  discount_amount: number;
  delivery_fee: number;
  processing_fee: number;
  total_amount: number;
}

export type RefreshQuoteResponse =
  | { status: 'valid'; quote: DeliveryQuote }
  | { status: 'renewed'; quote: DeliveryQuote; totals: OrderTotals }
  | { status: 'price_changed'; quote: DeliveryQuote; previousFee: number };

export interface PriceChange {
  previousFee: number;
  quote: DeliveryQuote;
}

/** Courier lifecycle (delivery.status) — separate from the kitchen's order status. */
export type DeliveryStatus =
  | 'QUOTED'
  | 'DISPATCHING'
  | 'FAILED'
  | 'PENDING'
  | 'COURIER_ASSIGNED'
  | 'PICKUP'
  | 'PICKUP_COMPLETE'
  | 'DROPOFF'
  | 'DELIVERED'
  | 'CANCELED'
  | 'RETURNED';
