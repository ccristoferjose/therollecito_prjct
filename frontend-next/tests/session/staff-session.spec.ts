import { test, expect, type Page } from '@playwright/test';

const now = new Date('2026-10-12T16:00:00Z');
const seconds = now.getTime() / 1000;
function token(exp: number, role = 'manager', iat = seconds - 43200) {
  return `header.${Buffer.from(JSON.stringify({ exp, iat, user_id: 7, role, location_id: 1 })).toString('base64url')}.signature`;
}

async function seed(page: Page, sessionToken: string, role = 'manager') {
  await page.clock.install({ time: now });
  await page.addInitScript(({ sessionToken, role }) => {
    localStorage.setItem('staff_token', sessionToken);
    localStorage.setItem('staff_user', JSON.stringify({ id: 7, role, location_id: 1, first_name: 'Kitchen', last_name: 'Staff' }));
  }, { sessionToken, role });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/kitchen/board') body = {
      queue: [], upcoming: [], preparing: [], ready: [], later_today: [],
      scheduled_count: 0, upcoming_window_minutes: 30, server_time: now.toISOString(),
    };
    await route.fulfill({ json: body });
  });
}

test('admin expiry redirects to login without automatic renewal', async ({ page }) => {
  await seed(page, token(seconds + 60, 'admin'), 'admin');
  let renewals = 0;
  await page.route('**/api/auth/staff/refresh', async (route) => { renewals++; await route.fulfill({ status: 500 }); });
  await page.goto('/staff/admin/users');
  await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(page).toHaveURL(/\/staff\/login\?reason=session-expired/);
  await expect(page.getByText('Your session expired. Please sign in again.')).toBeVisible();
  expect(renewals).toBe(0);
});

test('kitchen renews and subsequent board requests use the fresh token', async ({ page }) => {
  const original = token(seconds + 240);
  const renewed = token(seconds + 43200, 'manager', seconds);
  await seed(page, original);
  await page.route('**/api/auth/staff/refresh', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${original}`);
    await route.fulfill({ json: { token: renewed, user: { id: 7, role: 'manager', location_id: 1 } } });
  });
  const boardRequest = page.waitForRequest((request) => request.url().includes('/api/kitchen/board') && request.headers().authorization === `Bearer ${renewed}`);
  await page.goto('/staff/kitchen');
  await boardRequest;
  await expect(page.getByRole('heading', { name: 'New Orders' })).toBeVisible();
  await page.clock.fastForward(300000);
  await expect(page).toHaveURL(/\/staff\/kitchen$/);
  expect(await page.evaluate(() => localStorage.getItem('staff_token'))).toBe(renewed);
});

test('expired saved token is rejected on page load', async ({ page }) => {
  await seed(page, token(seconds - 1));
  await page.goto('/staff/kitchen');
  await expect(page).toHaveURL(/\/staff\/login\?reason=session-expired/);
  expect(await page.evaluate(() => localStorage.getItem('staff_token'))).toBeNull();
});

test('unauthorized kitchen requests redirect instead of leaving a stale board', async ({ page }) => {
  await seed(page, token(seconds + 43200, 'manager', seconds));
  await page.route('**/api/kitchen/board?*', (route) => route.fulfill({ status: 401, json: { error: 'Invalid or expired token.' } }));
  await page.goto('/staff/kitchen');
  await expect(page).toHaveURL(/\/staff\/login\?reason=session-expired/);
});

test('failed board refresh displays a warning and focus retries immediately', async ({ page }) => {
  await seed(page, token(seconds + 43200, 'manager', seconds));
  let requests = 0;
  await page.route('**/api/kitchen/board?*', async (route) => {
    requests++;
    await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
  });
  await page.goto('/staff/kitchen');
  await expect(page.getByRole('alert').filter({ hasText: 'Orders could not refresh' })).toBeVisible();
  const before = requests;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => requests).toBeGreaterThan(before);
});

test('temporary renewal failure retries while the kitchen session remains valid', async ({ page }) => {
  await seed(page, token(seconds + 240));
  const renewed = token(seconds + 43200, 'manager', seconds);
  let renewals = 0;
  await page.route('**/api/auth/staff/refresh', async (route) => {
    renewals++;
    if (renewals === 1) await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    else await route.fulfill({ json: { token: renewed, user: { id: 7, role: 'manager', location_id: 1 } } });
  });
  await page.goto('/staff/kitchen');
  await expect.poll(() => renewals).toBe(1);
  await page.clock.fastForward(16000);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('staff_token'))).toBe(renewed);
  await expect(page).toHaveURL(/\/staff\/kitchen$/);
});

test('existing socket listeners use the renewed token for new orders', async ({ page }) => {
  await seed(page, token(seconds + 600));
  const renewed = token(seconds + 43200, 'manager', seconds);
  let sendUpdate: (() => void) | undefined;
  await page.routeWebSocket('**/socket.io/**', (socket) => {
    socket.onMessage((message) => {
      if (typeof message === 'string' && message.startsWith('40/kitchen,')) {
        socket.send('40/kitchen,{"sid":"kitchen-test"}');
        sendUpdate = () => socket.send('42/kitchen,["order_updated",{"order_id":129}]');
      }
    });
    socket.send('0{"sid":"session-test","upgrades":[],"pingInterval":86400000,"pingTimeout":86400000}');
  });
  await page.route('**/api/auth/staff/refresh', (route) => route.fulfill({
    json: { token: renewed, user: { id: 7, role: 'manager', location_id: 1 } },
  }));
  await page.goto('/staff/kitchen');
  await expect.poll(() => Boolean(sendUpdate)).toBe(true);
  await page.clock.fastForward(301000);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('staff_token'))).toBe(renewed);
  const request = page.waitForRequest((request) => request.url().includes('/api/kitchen/board'));
  sendUpdate!();
  expect((await request).headers().authorization).toBe(`Bearer ${renewed}`);
});

test('kitchen continues polling across the original 12-hour expiry', async ({ page }) => {
  await seed(page, token(seconds + 43200, 'manager', seconds));
  const renewed = token(seconds + 86400, 'manager', seconds + 42960);
  let renewals = 0;
  await page.route('**/api/auth/staff/refresh', async (route) => {
    renewals++;
    await route.fulfill({ json: { token: renewed, user: { id: 7, role: 'manager', location_id: 1 } } });
  });
  await page.goto('/staff/kitchen');
  await expect(page.getByRole('heading', { name: 'New Orders' })).toBeVisible();
  await page.clock.fastForward((12 * 60 - 4) * 60000);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('staff_token'))).toBe(renewed);
  const nextPoll = page.waitForRequest((request) => request.url().includes('/api/kitchen/board'));
  await page.clock.fastForward(10 * 60000);
  expect((await nextPoll).headers().authorization).toBe(`Bearer ${renewed}`);
  await expect(page).toHaveURL(/\/staff\/kitchen$/);
  expect(renewals).toBe(1);
});
