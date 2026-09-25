import { test, expect } from '@playwright/test';
import path from 'node:path';
import { loadMenu, seedCart } from './helpers';

/**
 * WCAG 1.4.10 Reflow / 1.4.4 Resize text. 320 CSS px is the width a 1280px
 * window has at 400% zoom; 640px with deviceScaleFactor 2 is 200% zoom.
 * Fails if a page scrolls horizontally. Screenshots are saved for review.
 */
const SHOTS = path.join(__dirname, '..', '..', 'test-results', 'a11y', 'screens');

const VIEWPORTS = [
  { name: '320px', width: 320, height: 800, deviceScaleFactor: 1 },
  { name: '200pct', width: 640, height: 400, deviceScaleFactor: 2 },
];

for (const vp of VIEWPORTS) {
  test.describe(`reflow at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });

    test('customer pages do not scroll horizontally', async ({ page, request }) => {
      const fx = await loadMenu(request);
      await seedCart(page, fx, 2);
      const pages = [
        ['landing', '/'],
        ['order-menu', `/order?location=${fx.locationId}`],
        ['cart', '/cart'],
        ['track', '/track'],
        ['accessibility', '/accessibility'],
      ] as const;
      const overflow: string[] = [];
      for (const [name, url] of pages) {
        await page.goto(url);
        await page.getByRole('heading', { level: 1 }).first().waitFor();
        // Close the promo modal if it opened over the landing page.
        if (await page.getByRole('button', { name: 'Close promotion' }).isVisible().catch(() => false)) {
          await page.keyboard.press('Escape');
        }
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        await page.screenshot({ path: path.join(SHOTS, `${vp.name}-${name}.png`), fullPage: true });
        if (scrollWidth > clientWidth + 1) overflow.push(`${name}: ${scrollWidth}px content in ${clientWidth}px`);
      }
      // Checkout, reached through the cart (a direct load redirects to /cart).
      await page.goto('/cart');
      await page.getByRole('link', { name: /Proceed to Checkout/ }).click();
      await page.getByRole('heading', { level: 1, name: 'Checkout' }).waitFor();
      const co = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      await page.screenshot({ path: path.join(SHOTS, `${vp.name}-checkout.png`), fullPage: true });
      if (co[0] > co[1] + 1) overflow.push(`checkout: ${co[0]}px content in ${co[1]}px`);

      expect(overflow).toEqual([]);
    });
  });
}
