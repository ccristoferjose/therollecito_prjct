'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Clock, Pencil, Trash2, CalendarDays, AlertTriangle, Copy,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useStaffAuth } from '@/providers/staff-auth-provider';
import { useFetch } from '@/lib/hooks/use-fetch';
import { ApiError } from '@/lib/api/client';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Modal from '@/components/ui/modal';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import EmptyState from '@/components/ui/empty-state';
import type { Location } from '@/lib/types';
import type {
  AdminServicePeriod,
  MenuSummary,
  ServicePeriodAdminResponse,
  ServicePeriodSchedule,
} from './types';
import {
  clearSchedule, createPeriod, listPeriods, removePeriod, setSchedule, updatePeriod,
} from './admin-queries';

/**
 * day_of_week follows MySQL DAYOFWEEK(): 1 = Sunday .. 7 = Saturday. Index 0 is
 * unused so DAYS[n] maps straight to the stored value with no offset maths.
 */
const DAYS = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER = [2, 3, 4, 5, 6, 7, 1]; // Mon-Sun reads better than Sun-Sat

const emptyForm = { name: '', menuId: '', prepTimeMinutes: '0', sortOrder: '0' };
/** Used when a day is switched from Closed to open. */
const DEFAULT_HOURS = { start: '09:00', end: '17:00' };

const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : '');

export default function ServicePeriodManagement() {
  const { token } = useStaffAuth();
  const { data: locations, loading: locLoading } = useFetch<Location[]>('/locations/all', token);
  // sp_menu_get_all returns several result sets; only the menus list is needed.
  const { data: menuData } = useFetch<{ menus: MenuSummary[] }>('/menu/all', token);
  const menus = menuData?.menus || [];

  const [locationId, setLocationId] = useState<number | null>(null);
  const [data, setData] = useState<ServicePeriodAdminResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminServicePeriod | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminServicePeriod | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Default to the first location once the list arrives.
  useEffect(() => {
    if (locationId === null && locations?.length) setLocationId(locations[0].id);
  }, [locations, locationId]);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await listPeriods(locationId, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load service periods');
    } finally {
      setLoading(false);
    }
  }, [locationId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const periods = data?.periods || [];
  const schedules = data?.schedules || [];
  const scheduleFor = (periodId: number, day: number): ServicePeriodSchedule | undefined =>
    schedules.find((s) => s.service_period_id === periodId && s.day_of_week === day);

  // --- period create / edit -------------------------------------------------

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, menuId: menus[0] ? String(menus[0].id) : '' });
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(period: AdminServicePeriod) {
    setEditing(period);
    setForm({
      name: period.name,
      menuId: String(period.menu_id),
      prepTimeMinutes: String(period.prep_time_minutes),
      sortOrder: String(period.sort_order),
    });
    setSaveError(null);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) return;
    setSaveError(null);

    if (!form.name.trim()) return setSaveError('Name is required.');
    if (!form.menuId) return setSaveError('Pick a menu for this period.');

    setSaving(true);
    try {
      if (editing) {
        await updatePeriod(
          editing.id,
          {
            name: form.name.trim(),
            menu_id: Number(form.menuId),
            prep_time_minutes: Number(form.prepTimeMinutes) || 0,
            sort_order: Number(form.sortOrder) || 0,
          },
          token,
        );
      } else {
        await createPeriod(
          {
            location_id: locationId,
            menu_id: Number(form.menuId),
            name: form.name.trim(),
            prep_time_minutes: Number(form.prepTimeMinutes) || 0,
            sort_order: Number(form.sortOrder) || 0,
          },
          token,
        );
      }
      setShowModal(false);
      await load();
    } catch (err) {
      // Server-side rules (duplicate name at a location, unknown/inactive menu)
      // come back as a readable 400.
      setSaveError(err instanceof ApiError ? err.message : 'Could not save service period');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(period: AdminServicePeriod) {
    setError(null);
    try {
      await updatePeriod(period.id, { is_active: !period.is_active }, token);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update service period');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setError(null);
    try {
      const res = await removePeriod(confirmDelete.id, token);
      setNotice(
        res.result === 'deactivated'
          ? `"${confirmDelete.name}" has existing orders, so it was deactivated instead of deleted.`
          : `"${confirmDelete.name}" was deleted.`,
      );
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete service period');
    }
  }

  // --- schedule -------------------------------------------------------------

  async function saveDay(periodId: number, day: number, start: string, end: string) {
    setError(null);
    try {
      await setSchedule(periodId, { day_of_week: day, start_time: start, end_time: end }, token);
      await load();
    } catch (err) {
      // Overlap with another period, or end <= start — both raised by the server.
      setError(err instanceof ApiError ? err.message : 'Could not save hours');
    }
  }

  async function closeDay(periodId: number, day: number) {
    setError(null);
    try {
      await clearSchedule(periodId, day, token);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not close that day');
    }
  }

  /** Copy one day's hours onto every other day of the week. */
  async function copyToAllDays(periodId: number, from: ServicePeriodSchedule) {
    setError(null);
    try {
      for (const day of DAY_ORDER) {
        if (day === from.day_of_week) continue;
        await setSchedule(
          periodId,
          { day_of_week: day, start_time: hhmm(from.start_time), end_time: hhmm(from.end_time) },
          token,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not copy hours to every day');
    }
  }

  if (locLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Service periods</h2>
          <p className="text-sm text-text-secondary">
            One location can serve different menus at different times. The customer&apos;s selected
            pickup time decides which period — and therefore which menu — applies.
          </p>
        </div>
        <Button variant="accent" onClick={openCreate} disabled={!locationId || menus.length === 0}>
          <Plus size={16} /> Add service period
        </Button>
      </div>

      {menus.length === 0 && (
        <Card className="mb-4 border-warning bg-warning/10">
          <p className="text-sm">
            No active menus exist yet. Create a menu under <strong>Menu</strong> first — every
            service period must point at one.
          </p>
        </Card>
      )}

      {/* Location selector */}
      {(locations?.length || 0) > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {locations?.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setLocationId(loc.id)}
              aria-pressed={locationId === loc.id}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                locationId === loc.id
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              {loc.name}
              {!loc.is_active && <span className="ml-1 opacity-70">(inactive)</span>}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          {notice}{' '}
          <button type="button" className="underline" onClick={() => setNotice(null)}>
            dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-error bg-red-50 px-4 py-3 text-sm text-error"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : periods.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No service periods yet"
          description="Add one for each part of the day — for example Breakfast 7:00–11:30 and Lunch 11:30–17:00 — and give each its own menu."
        />
      ) : (
        <div className="space-y-4">
          {periods.map((period) => (
            <Card key={period.id} className={period.is_active ? '' : 'opacity-60'}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text">{period.name}</h3>
                    {!period.is_active && <Badge status="default">inactive</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Menu: <span className="font-medium text-text">{period.menu_name}</span>
                    {' · '}
                    {period.prep_time_minutes > 0
                      ? `${period.prep_time_minutes} min to prepare`
                      : 'no prep time'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleActive(period)}>
                    {period.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {period.is_active ? 'Active' : 'Inactive'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(period)}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(period)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
                  <CalendarDays size={15} /> Weekly hours
                </div>
                <p className="mb-3 text-xs text-text-secondary">
                  A day with no hours is closed for this period. Two periods at the same location
                  cannot overlap on the same day.
                </p>
                <div className="space-y-2">
                  {DAY_ORDER.map((day) => (
                    <DayRow
                      key={day}
                      day={day}
                      schedule={scheduleFor(period.id, day)}
                      onSave={(s, e) => saveDay(period.id, day, s, e)}
                      onClose={() => closeDay(period.id, day)}
                      onCopyAll={(s) => copyToAllDays(period.id, s)}
                    />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit period */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit service period' : 'Add service period'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Name"
            name="name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Breakfast"
            required
          />
          <div className="space-y-1">
            <label htmlFor="menu" className="block text-sm font-medium text-text">
              Menu
            </label>
            <select
              id="menu"
              value={form.menuId}
              onChange={(e) => setForm((p) => ({ ...p, menuId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Preparation time (minutes)"
            type="number"
            min={0}
            value={form.prepTimeMinutes}
            onChange={(e) => setForm((p) => ({ ...p, prepTimeMinutes: e.target.value }))}
          />
          <p className="-mt-2 text-xs text-text-secondary">
            Minimum lead time. A pickup slot is only offered if it is at least this far ahead, so a
            period stops being bookable once there is no time left to cook.
          </p>
          <Input
            label="Sort order"
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
          />

          {saveError && (
            <div className="rounded-lg border border-error bg-red-50 px-3 py-2 text-sm text-error">
              {saveError}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" className="flex-1" disabled={saving}>
              {saving ? <Spinner size="sm" /> : editing ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete service period"
      >
        <div className="space-y-4">
          <p className="text-sm text-text">
            Delete <strong>{confirmDelete?.name}</strong>? If any order was placed against it, it
            will be deactivated instead so order history stays intact.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * One weekday's hours. Local state so an admin can type both times before the
 * server sees either — saving on every keystroke would trip the
 * end_time > start_time rule mid-edit.
 */
function DayRow({
  day,
  schedule,
  onSave,
  onClose,
  onCopyAll,
}: {
  day: number;
  schedule?: ServicePeriodSchedule;
  onSave: (start: string, end: string) => void;
  onClose: () => void;
  onCopyAll: (s: ServicePeriodSchedule) => void;
}) {
  const [start, setStart] = useState(hhmm(schedule?.start_time) || DEFAULT_HOURS.start);
  const [end, setEnd] = useState(hhmm(schedule?.end_time) || DEFAULT_HOURS.end);

  // Re-sync when the parent reloads after a save.
  useEffect(() => {
    setStart(hhmm(schedule?.start_time) || DEFAULT_HOURS.start);
    setEnd(hhmm(schedule?.end_time) || DEFAULT_HOURS.end);
  }, [schedule?.start_time, schedule?.end_time]);

  const open = Boolean(schedule);
  const dirty = open && (start !== hhmm(schedule?.start_time) || end !== hhmm(schedule?.end_time));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <span className="w-24 shrink-0 text-sm font-medium text-text">{DAYS[day]}</span>

      {open ? (
        <>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-label={`${DAYS[day]} opening time`}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <span className="text-text-secondary">–</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-label={`${DAYS[day]} closing time`}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          {dirty && (
            <Button size="sm" variant="accent" onClick={() => onSave(start, end)}>
              Save
            </Button>
          )}
          {!dirty && schedule && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCopyAll(schedule)}
              title="Copy these hours to every other day"
            >
              <Copy size={13} /> Copy to all
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Closed
          </Button>
        </>
      ) : (
        <>
          <span className="text-sm text-text-secondary">Closed</span>
          <Button size="sm" variant="outline" onClick={() => onSave(start, end)}>
            <Plus size={13} /> Set hours
          </Button>
        </>
      )}
    </div>
  );
}
