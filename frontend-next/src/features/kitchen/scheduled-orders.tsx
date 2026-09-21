'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarClock, MapPin, ArrowLeft, Clock3, User, Package, MessageSquare, Flame,
} from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { formatCurrency, formatOrderNumber, formatTime, formatWhen } from '@/lib/utils/format';
import Card from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import type { Location } from '@/lib/types';
import type { ScheduledResponse, ScheduledOrder } from '@/features/kitchen/types';

/**
 * Future-dated orders — everything the kitchen does not need today.
 *
 * These are ordinary PAID orders; they are only "scheduled" because their
 * derived prepare_at falls on a later date. They flow onto the kitchen board on
 * their own as the clock reaches them, so there is nothing to action here —
 * this page is for planning.
 */
export default function ScheduledOrders() {
  const { token, user } = useStaffAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(user?.location_id || null);
  const locationId = isAdmin ? selectedLocationId : user?.location_id;

  const { data: locations } = useFetch<Location[]>(isAdmin ? '/locations' : null, token);

  useEffect(() => {
    if (isAdmin && !selectedLocationId && locations && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [isAdmin, selectedLocationId, locations]);

  const { data, loading } = useFetch<ScheduledResponse>(
    locationId ? `/kitchen/scheduled?location_id=${locationId}` : null,
    token,
  );

  // Group by the local calendar day of prepare_at — the day the kitchen will
  // actually cook it, which is not always the pickup day for a long lead time.
  const days = useMemo(() => {
    const groups = new Map<string, ScheduledOrder[]>();
    for (const order of data?.orders ?? []) {
      const key = new Date(order.prepare_at).toDateString();
      const list = groups.get(key);
      if (list) list.push(order);
      else groups.set(key, [order]);
    }
    return [...groups.entries()];
  }, [data]);

  const dayLabel = (key: string) =>
    new Date(key).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
    });

  const customerName = (o: ScheduledOrder) =>
    o.guest_name || [o.user_first_name, o.user_last_name].filter(Boolean).join(' ') || 'Registered customer';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/staff/kitchen"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-bold text-primary hover:bg-primary-light/40"
          >
            <ArrowLeft size={18} />
            Kitchen
          </Link>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-primary-dark">
            <CalendarClock size={26} className="text-primary" />
            Scheduled orders
          </h2>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-text-secondary" />
              <select
                value={selectedLocationId || ''}
                onChange={(e) => setSelectedLocationId(Number(e.target.value))}
                className="min-h-[44px] rounded-xl border border-border bg-surface px-3 py-2 text-base font-semibold text-primary-dark focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {(locations || []).map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}
          {loading && <Spinner size="sm" />}
        </div>
      </div>

      <p className="text-sm text-text-secondary">
        Paid orders for a later date. Each one moves onto the kitchen board by itself once its
        prep time arrives — nothing here needs to be started manually.
      </p>

      {!loading && days.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No scheduled orders"
          description="Orders placed for a future date will show up here."
        />
      ) : (
        days.map(([day, orders]) => (
          <Card key={day} padding={false} className="overflow-hidden">
            <header className="flex items-center justify-between bg-[#F2D6B3] px-4 py-3">
              <h3 className="text-base font-bold uppercase tracking-wide text-primary-dark">
                {dayLabel(day)}
              </h3>
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white/90 px-2.5 text-sm font-extrabold text-primary-dark">
                {orders.length}
              </span>
            </header>

            <ul className="divide-y divide-border/50">
              {orders.map((order) => (
                <li key={order.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-lg font-extrabold text-primary-dark">{formatOrderNumber(order)}</span>
                    {order.is_priority ? <Flame size={16} className="text-red-600" /> : null}
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1DC] px-2.5 py-1 text-xs font-bold text-[#A86A4A]">
                      <Clock3 size={12} />
                      prep {formatTime(order.prepare_at)}
                    </span>
                    {order.pickup_time && (
                      <span className="text-sm text-text-secondary">
                        pickup {formatWhen(order.pickup_time)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 truncate text-sm font-semibold text-primary-dark">
                      <User size={14} className="text-text-secondary" />
                      {customerName(order)}
                    </span>
                    <span className="ml-auto text-base font-extrabold text-primary">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Package size={13} />
                      {(order.items || []).reduce((n, i) => n + i.quantity, 0)} item
                      {(order.items || []).reduce((n, i) => n + i.quantity, 0) !== 1 ? 's' : ''}
                    </span>
                    <span className="truncate">
                      {(order.items || []).map((i) => `${i.quantity}× ${i.item_name}`).join(', ')}
                    </span>
                  </div>

                  {order.notes && order.notes.trim() && (
                    <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5 text-sm font-semibold text-primary-dark">
                      <MessageSquare size={14} className="mt-0.5 shrink-0 text-accent-hover" />
                      {order.notes.trim()}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
