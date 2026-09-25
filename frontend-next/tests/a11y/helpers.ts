import { type APIRequestContext, type Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Rules reported but not failed on. Each entry needs a reason and an owner
 * decision in docs/compliance/accessibility-audit.md — remove it once fixed.
 *
 * color-contrast: the brand primary (#A86A4A) with cream/white text is 3.9–4.35:1
 * on buttons and links. Fixing it changes the brand colour, which the UI
 * preservation requirement reserves for a design decision (audit item A-12).
 */
export const KNOWN_OPEN_RULES = new Set(['color-contrast']);

const RESULTS_DIR = path.join(__dirname, '..', '..', 'test-results', 'a11y');

export async function scan(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // Third-party frames: Stripe's card form and the Google map. Their
    // accessibility is the vendor's; they are reviewed manually instead.
    .exclude('iframe[src*="js.stripe.com"]')
    .exclude('iframe[src*="google.com/maps"]')
    .analyze();

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 10),
    count: v.nodes.length,
  }));
  fs.writeFileSync(
    path.join(RESULTS_DIR, `${name.replace(/[^a-z0-9]+/gi, '-')}.json`),
    JSON.stringify({ page: name, url: page.url(), passes: results.passes.length, violations: summary }, null, 2),
  );

  const blocking = results.violations.filter((v) => !KNOWN_OPEN_RULES.has(v.id));
  expect(
    blocking.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    `axe violations on ${name}`,
  ).toEqual([]);
  return results;
}

/** Local wall-clock "YYYY-MM-DDTHH:mm:00" for tomorrow at the given time. */
export function tomorrowAt(hh: number, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(hh)}:${p(mm)}:00`;
}

export interface MenuFixture {
  locationId: number;
  locationName: string;
  pickupTime: string;
  items: { id: number; name: string; price: number; image_url?: string | null }[];
  optionItemIds: number[];
}

export async function loadMenu(request: APIRequestContext): Promise<MenuFixture> {
  const locations = await (await request.get('/api/locations')).json();
  const locationId = locations[0].id as number;
  const pickupTime = tomorrowAt(9);
  const menu = await (
    await request.get(`/api/menu/location/${locationId}/pickup?pickupTime=${encodeURIComponent(pickupTime)}`)
  ).json();
  return {
    locationId,
    locationName: locations[0].name as string,
    pickupTime,
    items: menu.items,
    optionItemIds: [...new Set((menu.options as { item_id: number }[]).map((o) => o.item_id))],
  };
}

/** Pre-load cart + pickup time the way the app stores them. */
export async function seedCart(page: Page, fx: MenuFixture, count = 2) {
  const entries = fx.items.slice(0, count).map((item) => ({
    key: `${item.id}-[]`,
    item: { id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url ?? null },
    options: [],
    quantity: 1,
  }));
  await page.addInitScript(
    ([cart, pickup]) => {
      window.localStorage.setItem('yumyum_cart', cart);
      window.localStorage.setItem('yumyum_pickup', pickup);
      window.localStorage.setItem('rollecito_promo_seen', '{}');
    },
    [JSON.stringify({ items: entries, locationId: fx.locationId }), fx.pickupTime] as const,
  );
}

/** Description of the focused element: its accessible-ish name. */
export async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return '';
    return (el.getAttribute('aria-label') || el.innerText || el.getAttribute('name') || el.tagName).trim();
  });
}

/**
 * Press Tab (or Shift+Tab) until the focused element's name matches, like a
 * keyboard user would. Fails if it never gets there.
 */
export async function tabTo(page: Page, match: RegExp, { max = 80, back = false } = {}) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    if (match.test(await focused(page))) return;
  }
  throw new Error(`Could not reach ${match} by keyboard within ${max} presses (last: "${await focused(page)}")`);
}

export async function liveRegionText(page: Page): Promise<string> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="status"][aria-live="polite"]'))
      .map((n) => n.textContent ?? '')
      .join(' | '),
  );
}
