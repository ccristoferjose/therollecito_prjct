import { Bike } from 'lucide-react';

/** Loud "DELIVERY" tag so a delivery order is never mistaken for a pickup. */
export function DeliveryTag({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[#2F5D7C] font-extrabold uppercase tracking-wide text-white ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <Bike size={compact ? 11 : 13} aria-hidden="true" />
      Delivery
    </span>
  );
}

const COURIER_LABELS: Record<string, { label: string; className: string }> = {
  QUOTED: { label: 'Courier not requested yet', className: 'bg-gray-100 text-text-secondary border-gray-200' },
  DISPATCHING: { label: 'Requesting courier…', className: 'bg-gray-100 text-text-secondary border-gray-200' },
  FAILED: { label: 'Courier request failed', className: 'bg-red-50 text-red-700 border-red-200' },
  PENDING: { label: 'Finding a courier', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  COURIER_ASSIGNED: { label: 'Courier assigned', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  PICKUP: { label: 'Courier on the way', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  PICKUP_COMPLETE: { label: 'Picked up', className: 'bg-green-50 text-green-700 border-green-200' },
  DROPOFF: { label: 'Out for delivery', className: 'bg-green-50 text-green-700 border-green-200' },
  DELIVERED: { label: 'Delivered', className: 'bg-green-50 text-green-700 border-green-200' },
  CANCELED: { label: 'Courier canceled', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  RETURNED: { label: 'Returned to store', className: 'bg-amber-50 text-amber-800 border-amber-200' },
};

/** Courier status (provider-controlled) — informational only on the board. */
export function CourierStatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const spec = COURIER_LABELS[status] || { label: status, className: 'bg-gray-100 text-text-secondary border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${spec.className}`}>
      <Bike size={12} aria-hidden="true" />
      {spec.label}
    </span>
  );
}
