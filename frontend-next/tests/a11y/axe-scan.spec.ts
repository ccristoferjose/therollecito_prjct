import { test, expect } from '@playwright/test';
import { scan, loadMenu, seedCart } from './helpers';

/**
 * axe-core WCAG 2.2 A/AA scan of every customer-facing page and dialog state.
 * Automated checks find roughly a third of WCAG issues; keyboard-flow.spec.ts
 * and the manual VoiceOver script in the audit report cover the rest.
 */

test.describe('axe WCAG 2.2 AA scan', () => {
  test('landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scan(page, 'landing');
  });

  test('locations list and detail', async ({ page, request }) => {
    const { locationId } = await loadMenu(request);
    await page.goto('/locations');
    await scan(page, 'locations');
    await page.goto(`/locations/${locationId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scan(page, 'location-detail');
  });

  test('order: choose location', async ({ page }) => {
    await page.goto('/order');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scan(page, 'order-choose-location');
  });

  test('order: menu, product dialog, pickup dialog', async ({ page, request }) => {
    const fx = await loadMenu(request);
    await seedCart(page, fx, 0);
    await page.goto(`/order?location=${fx.locationId}`);
    await expect(page.getByRole('group', { name: 'Menu categories' })).toBeVisible();
    await scan(page, 'order-menu');

    await page.getByRole('button', { name: /^Add / }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(page, 'order-product-dialog');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /pickup time|time for pickup/ }).click();
    await expect(page.getByRole('dialog', { name: /pick up/ })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Day' })).toBeVisible();
    await scan(page, 'order-pickup-dialog');
  });

  test('cart', async ({ page, request }) => {
    const fx = await loadMenu(request);
    await seedCart(page, fx, 2);
    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1, name: /cart/i })).toBeVisible();
    await scan(page, 'cart');
  });

  test('cart empty', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /empty/i })).toBeVisible();
    await scan(page, 'cart-empty');
  });

  test('checkout with invalid promo code', async ({ page, request }) => {
    const fx = await loadMenu(request);
    await seedCart(page, fx, 2);
    // Arrive from the cart like a customer: loading /checkout directly
    // redirects to /cart before the stored cart has hydrated.
    await page.goto('/cart');
    await page.getByRole('link', { name: /Proceed to Checkout/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    await scan(page, 'checkout');
    await page.getByLabel('Promo code').fill('NOTAREALCODE');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /./ }).first()).toBeVisible();
    await expect(page.getByLabel('Promo code')).toHaveAttribute('aria-invalid', 'true');
    await scan(page, 'checkout-promo-error');
  });

  test('track lookup, profile, statement pages, 404', async ({ page }) => {
    for (const [name, url] of [
      ['track-lookup', '/track'],
      ['track-not-found', '/track/00000000-0000-1000-8000-000000000000'],
      ['profile-signed-out', '/profile'],
      ['accessibility-statement', '/accessibility'],
      // /privacy is a 404 in production builds until the policy is approved.
      ['privacy-draft', '/privacy'],
      ['not-found', '/this-page-does-not-exist'],
    ] as const) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await scan(page, name);
    }
  });
});
