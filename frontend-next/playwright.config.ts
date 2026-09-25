import { defineConfig } from '@playwright/test';

/**
 * Accessibility checks (axe-core WCAG 2.2 AA scan, keyboard-only purchase
 * flow, reflow at 320px and 200% zoom). See docs/compliance/accessibility-audit.md.
 *
 * Needs the app running with a backend and a Stripe TEST key — it places a
 * real (test-mode) order. Never point PLAYWRIGHT_BASE_URL at production.
 *
 *   npm run dev            # frontend-next on :3000, backend on :3001
 *   npm run test:a11y
 *
 * Uses the installed Google Chrome (channel: 'chrome'), so no Playwright
 * browser download is needed.
 */
export default defineConfig({
  testDir: './tests/a11y',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    channel: 'chrome',
    locale: 'en-US',
    timezoneId: process.env.TZ ?? 'America/Los_Angeles',
    trace: 'retain-on-failure',
  },
});
