import { api } from '@/lib/api/client';
import type { AdminServicePeriod, ServicePeriodSchedule } from './types';

/** Days of the week a period runs, collapsed into a readable label. */
export interface PublishedPeriod {
  id: number;
  name: string;
  menuName: string;
  /** e.g. "7:00 AM – 11:00 AM" */
  hours: string;
  /** e.g. "Mon – Sat" or "Every day" */
  days: string;
}

const DAY_SHORT = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Mon-first reading order; day_of_week itself is MySQL's 1=Sun..7=Sat. */
const WEEK_ORDER = [2, 3, 4, 5, 6, 7, 1];

function to12h(time: string): string {
  const [hStr, m] = time.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return m === '00' ? `${h12} ${period}` : `${h12}:${m} ${period}`;
}

/** "Mon – Sat", "Every day", or a comma list when the days aren't contiguous. */
function describeDays(days: number[]): string {
  if (days.length === 7) return 'Every day';
  const ordered = WEEK_ORDER.filter((d) => days.includes(d));
  if (ordered.length === 0) return '';
  if (ordered.length === 1) return DAY_SHORT[ordered[0]];

  // Contiguous in Mon-first order → render as a range.
  const idx = ordered.map((d) => WEEK_ORDER.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return contiguous
    ? `${DAY_SHORT[ordered[0]]} – ${DAY_SHORT[ordered[ordered.length - 1]]}`
    : ordered.map((d) => DAY_SHORT[d]).join(', ');
}

/**
 * A location's published service periods, for the marketing pages.
 *
 * Reads the public /schedule endpoint so the landing page states real opening
 * hours and updates itself whenever an admin edits a period — no hardcoded
 * times to drift out of date. Resolves to [] on any failure so a backend blip
 * degrades the section away instead of breaking the page.
 */
export async function getPublishedPeriods(locationId: number): Promise<PublishedPeriod[]> {
  try {
    const res = await api.get<{
      periods: AdminServicePeriod[];
      schedules: ServicePeriodSchedule[];
    }>(`/service-periods/location/${locationId}/schedule`, null, {
      next: { revalidate: 300 },
    });

    return (res.periods || [])
      .filter((p) => p.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => {
        const rows = (res.schedules || []).filter((s) => s.service_period_id === p.id);
        if (rows.length === 0) return null;
        // Periods normally keep the same hours across their days; show the
        // most common window rather than inventing a range per day.
        const { start_time, end_time } = rows[0];
        return {
          id: p.id,
          name: p.name,
          menuName: p.menu_name,
          hours: `${to12h(start_time)} – ${to12h(end_time)}`,
          days: describeDays(rows.map((r) => r.day_of_week)),
        };
      })
      .filter((p): p is PublishedPeriod => p !== null);
  } catch {
    return [];
  }
}
