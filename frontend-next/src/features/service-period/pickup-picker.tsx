'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, CalendarDays, AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { usePickup } from '@/providers/pickup-provider';
import { useAnnounce } from '@/providers/announcer-provider';
import {
  fromLocalDateTime,
  listBookablePeriods,
  toLocalDate,
  toLocalDateTime,
} from './queries';
import type { BookablePeriod } from './types';

/** How far ahead a customer may schedule, in days. */
const DAYS_AHEAD = 7;
/** Spacing of selectable pickup slots, in minutes. */
const SLOT_MINUTES = 15;

function formatSlotLabel(value: string): string {
  return fromLocalDateTime(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDayLabel(date: Date, today: Date): string {
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isToday) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Build selectable slots inside a period's bookable window. `earliest_pickup`
 * already accounts for prep time (the backend clamps it to now + prep when the
 * window is in progress), so slots are simply stepped from there.
 */
function buildSlots(period: BookablePeriod): string[] {
  const start = fromLocalDateTime(period.earliest_pickup);
  const end = fromLocalDateTime(period.latest_pickup);
  // Round the first slot up to the next clean interval.
  const cursor = new Date(start);
  cursor.setSeconds(0, 0);
  const remainder = cursor.getMinutes() % SLOT_MINUTES;
  if (remainder !== 0) cursor.setMinutes(cursor.getMinutes() + (SLOT_MINUTES - remainder));

  const slots: string[] = [];
  while (cursor <= end && slots.length < 96) {
    slots.push(toLocalDateTime(cursor));
    cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
  }
  return slots;
}

interface PickupPickerProps {
  locationId: number;
  /** Label of the menu currently shown, e.g. "Afternoon Menu". */
  menuName?: string | null;
  /** Rendered when the customer has not chosen a time yet. */
  requireSelection?: boolean;
}

/**
 * Shows the selected pickup time next to the menu, because changing it can
 * change what is available. Opening it lets the customer pick a day and slot;
 * the resolved service period decides which menu loads.
 */
export default function PickupPicker({
  locationId,
  menuName,
  requireSelection = false,
}: PickupPickerProps) {
  const { pickupTime, setPickupTime, validating } = usePickup();
  const [open, setOpen] = useState(false);
  const [today] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDate(new Date()));
  const [periods, setPeriods] = useState<BookablePeriod[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string[] | null>(null);
  const announce = useAnnounce();

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const load = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        setPeriods(await listBookablePeriods(locationId, date));
      } catch {
        setPeriods([]);
      } finally {
        setLoading(false);
      }
    },
    [locationId],
  );

  useEffect(() => {
    if (open) void load(selectedDate);
  }, [open, selectedDate, load]);

  async function choose(slot: string) {
    const unavailable = await setPickupTime(slot);
    setOpen(false);
    // Confirm the choice: the dialog closes and the summary line updates away
    // from focus. An unavailable-items warning (role="alert") speaks for itself.
    if (!unavailable.length) {
      announce(
        `Pickup time set to ${formatDayLabel(fromLocalDateTime(slot), today)} at ${formatSlotLabel(slot)}.`,
      );
    }
    // Items are flagged, never dropped — the customer decides what to do.
    setWarning(unavailable.length ? unavailable.map((u) => u.item_name) : null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          {pickupTime ? (
            <span>
              <span className="text-text-secondary">Pickup: </span>
              <span className="font-semibold">
                {formatDayLabel(fromLocalDateTime(pickupTime), today)} at{' '}
                {formatSlotLabel(pickupTime)}
              </span>
              {menuName ? <span className="text-text-secondary"> · {menuName}</span> : null}
            </span>
          ) : (
            <span className={requireSelection ? 'font-semibold' : 'text-text-secondary'}>
              {requireSelection
                ? 'Choose a pickup time to see the menu'
                : 'Pickup: as soon as possible'}
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={validating}
          aria-haspopup="dialog"
          aria-label={pickupTime ? 'Change pickup time' : 'Choose a time for pickup'}
        >
          {pickupTime ? 'Change' : 'Choose a time'}
        </Button>
      </div>

      {warning ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-warning bg-warning/10 px-4 py-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Some items in your cart are not available at the new pickup time.
            </p>
            <p className="text-text-secondary">{warning.join(', ')}</p>
            <p className="mt-1 text-text-secondary">
              They are still in your cart — remove or replace them before checking out.
            </p>
          </div>
        </div>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="When would you like to pick up?">
        <div className="space-y-4">
          <div>
            <h3 id="pickup-day-label" className="mb-2 flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Day
            </h3>
            <div role="group" aria-labelledby="pickup-day-label" className="flex flex-wrap gap-2">
              {days.map((d) => {
                const value = toLocalDate(d);
                const active = value === selectedDate;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedDate(value)}
                    aria-pressed={active}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      active ? 'border-primary bg-primary text-white' : 'border-border'
                    }`}
                  >
                    {formatDayLabel(d, today)}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner label="Loading pickup times…" />
            </div>
          ) : !periods?.length ? (
            <p className="py-6 text-center text-sm text-text-secondary">
              No pickup times available on this day.
            </p>
          ) : (
            periods.map((period) => {
              const slots = buildSlots(period);
              return (
                <div key={period.id}>
                  <h3 id={`pickup-period-${period.id}`} className="mb-2 text-sm font-semibold">{period.name}</h3>
                  {slots.length === 0 ? (
                    <p className="text-sm text-text-secondary">No times left in this period.</p>
                  ) : (
                    <div role="group" aria-labelledby={`pickup-period-${period.id}`} className="flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          aria-pressed={slot === pickupTime}
                          onClick={() => void choose(slot)}
                          className={`rounded-md border px-3 py-1.5 text-sm ${
                            slot === pickupTime
                              ? 'border-primary bg-primary text-white'
                              : 'border-border hover:border-primary'
                          }`}
                        >
                          {formatSlotLabel(slot)}
                        </button>
                      ))}
                    </div>
                  )}
                  {period.prep_time_minutes > 0 ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      Needs {period.prep_time_minutes} min to prepare.
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </>
  );
}
