/**
 * A promotional campaign — the artwork and schedule behind the homepage modal.
 *
 * Deliberately separate from `Promotion` (the discount engine). A campaign may
 * advertise a code, or it may be a pure announcement with `promotion_id: null`.
 */

export type PromoFrequency = 'once_per_day' | 'once_per_session' | 'always';

/** DAYOFWEEK() numbering, shared with the backend: 1 = Sunday ... 7 = Saturday. */
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Sunday', short: 'Sun' },
  { value: 2, label: 'Monday', short: 'Mon' },
  { value: 3, label: 'Tuesday', short: 'Tue' },
  { value: 4, label: 'Wednesday', short: 'Wed' },
  { value: 5, label: 'Thursday', short: 'Thu' },
  { value: 6, label: 'Friday', short: 'Fri' },
  { value: 7, label: 'Saturday', short: 'Sat' },
];

export const FREQUENCY_OPTIONS: { value: PromoFrequency; label: string; hint: string }[] = [
  { value: 'once_per_day', label: 'Once per day', hint: 'Shown again the next calendar day' },
  { value: 'once_per_session', label: 'Once per session', hint: 'Shown again in a new browser tab session' },
  { value: 'always', label: 'Every visit', hint: 'Shown on every page load' },
];

/** What the public /promo-campaigns/active endpoint returns. */
export interface ActivePromoCampaign {
  id: number;
  name: string;
  image_desktop_url?: string | null;
  image_mobile_url?: string | null;
  image_alt?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  frequency: PromoFrequency;
  starts_on: string;
  ends_on?: string | null;
  /** Only present when the linked promotion is itself still redeemable. */
  promo_code?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
}

/** The admin view, with scheduling fields the public endpoint omits. */
export interface PromoCampaign extends ActivePromoCampaign {
  promotion_id?: number | null;
  priority: number;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
  /** Empty means the campaign runs every day. */
  days: number[];
  day_names: string[];
  runs_every_day: boolean;
}
