'use client';

import { AlertTriangle, Bike, Clock, ExternalLink, Home, Star, User } from 'lucide-react';
import Card from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { formatTime } from '@/lib/utils/format';
import type { Order } from '@/lib/types';

const ENDED = ['CANCELED', 'RETURNED'];
/** Statuses where a courier is (or should be) attached to the delivery. */
const WITH_COURIER = ['COURIER_ASSIGNED', 'PICKUP', 'PICKUP_COMPLETE', 'DROPOFF'];
/** The courier has the food. */
const EN_ROUTE = ['PICKUP_COMPLETE', 'DROPOFF'];

/**
 * One plain sentence for where the delivery stands. The kitchen's status
 * (order.status_name) and the courier's (order.delivery_status) are separate
 * lifecycles; this combines them the way a customer thinks about it.
 */
function statusMessage(order: Order): { title: string; detail?: string } {
  const courier = order.courier_name || 'Your courier';
  const imminent = Boolean(Number(order.courier_imminent));
  const store = order.location_name || 'the bakery';

  switch (order.delivery_status) {
    case 'DELIVERED':
      return { title: 'Delivered', detail: 'Enjoy your order!' };
    case 'CANCELED':
    case 'RETURNED':
      return {
        title: 'Delivery canceled',
        detail: `Please contact ${store} and we'll make it right.`,
      };
    case 'DROPOFF':
    case 'PICKUP_COMPLETE':
      return imminent
        ? { title: `${courier} is almost there`, detail: 'Your order is arriving now.' }
        : { title: `${courier} is on the way`, detail: 'Your order has left the bakery.' };
    case 'PICKUP':
    case 'COURIER_ASSIGNED':
      return imminent
        ? { title: `${courier} is arriving at ${store}`, detail: 'They are about to pick up your order.' }
        : { title: `${courier} is heading to ${store}`, detail: 'They will pick up your order when it is ready.' };
    case 'PENDING':
      return { title: 'Finding a courier', detail: 'We have requested a courier for your order.' };
    default:
      // QUOTED / DISPATCHING / FAILED — staff retry a failed request, so the
      // customer is not alarmed by the internal state.
      return order.status_name === 'PAID' || order.status_name === 'PREPARING'
        ? { title: 'Preparing your order', detail: 'We will request a courier shortly.' }
        : { title: 'Arranging your courier', detail: 'This usually takes a minute or two.' };
  }
}

/** "customer_unavailable" -> "Customer unavailable". */
function humanize(reason: string): string {
  const text = reason.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function CourierDetails({ order }: { order: Order }) {
  const imminent = Boolean(Number(order.courier_imminent));
  const rating = order.courier_rating != null ? Number(order.courier_rating) : null;
  const vehicle = [order.courier_vehicle, order.courier_license_plate].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-primary-light/20 p-3">
      {order.courier_image_url ? (
        // Provider-hosted photo (https only — validated server-side). A plain
        // <img>: next/image would need every provider CDN whitelisted.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={order.courier_image_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light">
          <User size={20} className="text-primary" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-text">
          <span className="sr-only">Your courier: </span>
          {order.courier_name}
          {rating != null && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-text-secondary">
              <Star size={12} className="fill-accent text-accent" aria-hidden="true" />
              {rating.toFixed(1)}
              <span className="sr-only"> out of 5</span>
            </span>
          )}
        </p>
        {vehicle && <p className="truncate text-xs text-text-secondary">{vehicle}</p>}
      </div>
      {imminent && (
        <span className="shrink-0 animate-pulse rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
          Arriving now
        </span>
      )}
    </div>
  );
}

/**
 * Delivery tracking for the customer's order page.
 *
 * Live position and courier contact are left to the provider's own tracking
 * page: `delivery_tracking_url` is used exactly as the provider returned it
 * (Uber asks that it not be modified), opened in a new tab. Everything shown
 * here arrives through our webhook -> socket push; the browser never polls the
 * provider.
 */
export default function DeliveryTrackingCard({ order }: { order: Order }) {
  const status = order.delivery_status ?? '';
  const ended = ENDED.includes(status);
  const delivered = status === 'DELIVERED';
  const { title, detail } = statusMessage(order);
  const showCourier = Boolean(order.courier_name) && WITH_COURIER.includes(status);
  const eta = !ended && !delivered ? order.delivery_dropoff_eta : null;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
          {delivered ? (
            <Home size={20} className="text-primary" aria-hidden="true" />
          ) : ended ? (
            <AlertTriangle size={20} className="text-amber-600" aria-hidden="true" />
          ) : (
            <Bike size={20} className="text-primary" aria-hidden="true" />
          )}
        </div>
        {/* Polite live region: socket updates re-render this without a reload. */}
        <div className="min-w-0 flex-1" aria-live="polite">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {detail && <p className="text-sm text-text-secondary">{detail}</p>}
        </div>
        {eta && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-text-secondary">{EN_ROUTE.includes(status) ? 'Arriving by' : 'Estimated arrival'}</p>
            <p className="text-lg font-bold text-primary-dark">{formatTime(eta)}</p>
          </div>
        )}
      </div>

      {showCourier && (
        <div className="mt-4">
          <CourierDetails order={order} />
        </div>
      )}

      {ended && order.delivery_undeliverable_reason && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Reason: {humanize(order.delivery_undeliverable_reason)}
        </p>
      )}

      {order.delivery_tracking_url && !ended ? (
        <>
          <a
            href={order.delivery_tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              variant: delivered ? 'outline' : 'primary',
              size: delivered ? 'sm' : 'md',
              className: 'mt-4 w-full',
            })}
          >
            <ExternalLink size={16} aria-hidden="true" /> {delivered ? 'View delivery details' : 'Track delivery'}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {!delivered && (
            <p className="mt-1.5 text-center text-xs text-text-secondary">
              Live map and courier contact, provided by our delivery partner.
            </p>
          )}
        </>
      ) : (
        !ended &&
        !delivered && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
            <Clock size={12} aria-hidden="true" /> Your live tracking link appears here once a courier is requested.
          </p>
        )
      )}

      <div className="mt-4 border-t border-border pt-3 text-sm">
        <p className="text-xs text-text-secondary">Delivering to</p>
        <p className="font-medium text-text">
          {order.delivery_street_address}
          {order.delivery_apartment ? `, ${order.delivery_apartment}` : ''}
        </p>
        <p className="text-xs text-text-secondary">
          {order.delivery_city}, {order.delivery_state} {order.delivery_zip_code} · from {order.location_name}
        </p>
      </div>
    </Card>
  );
}
