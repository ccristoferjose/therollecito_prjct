'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Hourglass, ChevronRight, CalendarClock, Clock3, MessageSquare, Package } from 'lucide-react';
import { formatCurrency, formatOrderNumber, formatTime } from '@/lib/utils/format';
import type { KitchenOrder, LaterTodayOrder } from '@/features/kitchen/types';

/**
 * Everything the kitchen is NOT working on yet, kept out of the active columns.
 *
 * Upcoming orders are shown because they are about to become workable. "Later
 * today" is a collapsed workload preview — deliberately not a queue, so it has
 * no start button and no items loaded. Future dates live on /staff/kitchen/scheduled.
 */
export default function KitchenScheduleStrip({
  upcoming,
  laterToday,
  scheduledCount,
  windowMinutes,
}: {
  upcoming: KitchenOrder[];
  laterToday: LaterTodayOrder[];
  scheduledCount: number;
  windowMinutes: number;
}) {
  const [laterOpen, setLaterOpen] = useState(false);

  const customerName = (o: { guest_name?: string | null; user_first_name?: string | null; user_last_name?: string | null }) =>
    o.guest_name || [o.user_first_name, o.user_last_name].filter(Boolean).join(' ') || 'Registered customer';

  return (
    <section className="border-t border-border/60 bg-surface">
      {/* ---------------------------------------------------------------- */}
      {/* Upcoming — inside the window, not yet workable                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Hourglass size={16} className="text-[#A86A4A]" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-primary-dark">
            Upcoming
          </h3>
          <span className="text-xs font-semibold text-text-secondary">
            · next {windowMinutes} min
          </span>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F2D6B3] px-2 text-xs font-extrabold text-primary-dark">
            {upcoming.length}
          </span>
        </div>

        {upcoming.length === 0 ? (
          <p className="py-1 text-sm text-text-secondary">
            Nothing due in the next {windowMinutes} minutes.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {upcoming.map((order) => (
              <article
                key={order.id}
                className="flex min-w-[210px] shrink-0 flex-col gap-1 rounded-xl border border-dashed border-[#A86A4A]/50 bg-[#FFF1DC]/60 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-extrabold text-primary-dark">{formatOrderNumber(order)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-[#A86A4A]">
                    <Clock3 size={12} />
                    prep {order.prepare_at ? formatTime(order.prepare_at) : '—'}
                  </span>
                </div>
                <span className="truncate text-sm font-semibold text-primary-dark">{customerName(order)}</span>
                <div className="flex items-center justify-between gap-2 text-xs text-text-secondary">
                  <span>{order.pickup_time ? `Pickup ${formatTime(order.pickup_time)}` : 'ASAP'}</span>
                  <span className="font-bold text-primary">{formatCurrency(order.total_amount)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Later today (collapsed) + link to the Scheduled page              */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2">
        <button
          type="button"
          onClick={() => setLaterOpen((v) => !v)}
          aria-expanded={laterOpen}
          disabled={laterToday.length === 0}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold text-primary-dark transition-colors hover:bg-primary-light/40 disabled:cursor-default disabled:opacity-50"
        >
          <ChevronRight size={16} className={`transition-transform ${laterOpen ? 'rotate-90' : ''}`} />
          Later today
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-extrabold text-text-secondary">
            {laterToday.length}
          </span>
        </button>

        <Link
          href="/staff/kitchen/scheduled"
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-primary-light/40"
        >
          <CalendarClock size={16} />
          Scheduled
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-light px-2 text-xs font-extrabold text-primary-dark">
            {scheduledCount}
          </span>
        </Link>
      </div>

      {laterOpen && laterToday.length > 0 && (
        <ul className="max-h-48 overflow-y-auto border-t border-border/60 bg-[#FFF1DC]/40 px-4 py-2">
          {laterToday.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 py-2 text-sm last:border-b-0"
            >
              <span className="font-extrabold text-primary-dark">{formatOrderNumber(order)}</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#A86A4A]">
                <Clock3 size={13} />
                prep {formatTime(order.prepare_at)}
              </span>
              {order.pickup_time && (
                <span className="text-text-secondary">pickup {formatTime(order.pickup_time)}</span>
              )}
              <span className="truncate text-primary-dark">{customerName(order)}</span>
              <span className="inline-flex items-center gap-1 text-text-secondary">
                <Package size={13} />
                {order.item_count}
              </span>
              {order.notes && order.notes.trim() && (
                <MessageSquare size={13} className="text-accent-hover" aria-label="Customer note" />
              )}
              <span className="ml-auto font-bold text-primary">{formatCurrency(order.total_amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
