import { test, expect, type Page } from '@playwright/test';
import { scan, loadMenu, tabTo, focused, liveRegionText } from './helpers';

/**
 * The whole purchase journey with the keyboard only — no clicks. Places a
 * TEST-mode order and pays with Stripe's 4242 test card.
 */

async function expectFocusInsideDialog(page: Page) {
  const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  expect(inside, 'focus should be inside the open dialog').toBe(true);
}

test('keyboard-only purchase flow', async ({ page, request }) => {
  test.setTimeout(180_000);
  const fx = await loadMenu(request);
  const withOptions = fx.items.find((i) => fx.optionItemIds.includes(i.id)) ?? fx.items[0];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  await page.goto('/order');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  // Skip link is the first stop and moves focus to <main>.
  await page.keyboard.press('Tab');
  expect(await focused(page)).toBe('Skip to main content');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main-content');

  // 1. Location (was a <div onClick>: unreachable before this change).
  await expect(page.getByRole('button', { name: fx.locationName })).toBeVisible();
  await tabTo(page, new RegExp(`^${esc(fx.locationName)}$`));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/location=/);

  // 2. Pickup time dialog: focus in, pick tomorrow 9:00, focus returns.
  await tabTo(page, /time for pickup|pickup time/i);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectFocusInsideDialog(page);
  await tabTo(page, /^Tomorrow$/);
  await page.keyboard.press('Enter');
  await tabTo(page, /^9:00\s?AM$/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await focused(page)).toMatch(/pickup time/i);
  await expect.poll(() => liveRegionText(page)).toMatch(/Pickup time set to Tomorrow at 9:00/);

  // 3. Product dialog: open, Escape returns focus, reopen, choose options, add.
  const addName = new RegExp(`^Add ${esc(withOptions.name)}$`);
  await tabTo(page, addName, { max: 120 });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: withOptions.name })).toBeVisible();
  await expectFocusInsideDialog(page);
  // Focus is trapped: 40 Tabs never leave the dialog.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    await expectFocusInsideDialog(page);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await focused(page)).toMatch(addName);

  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  const checkboxes = page.getByRole('dialog').getByRole('checkbox');
  if ((await checkboxes.count()) > 0) {
    await tabTo(page, /./); // first control after the Close button
    while (!(await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type === 'checkbox'))) {
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Space');
    await expect(checkboxes.first()).toBeChecked();
  }
  await tabTo(page, /^Add to Cart/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(() => liveRegionText(page)).toMatch(/added to cart\. 1 item in cart/);

  // 4. Header cart link now exposes the count; go to the cart.
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cart (1 item in cart)' }),
  ).toBeAttached();
  await tabTo(page, /^Cart/, { back: true, max: 120 });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole('heading', { level: 1, name: /cart/i })).toBeVisible();

  await tabTo(page, new RegExp(`^Increase quantity of ${esc(withOptions.name)}$`));
  await page.keyboard.press('Enter');
  await expect.poll(() => liveRegionText(page)).toMatch(/quantity 2/);
  await tabTo(page, /^Proceed to Checkout/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/checkout$/);

  // 5. Checkout: required-field validation, invalid promo, then continue.
  await tabTo(page, /Continue to Payment|Place Order/);
  await page.keyboard.press('Enter');
  // Native validation keeps us on the form and focuses the empty name field.
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement)?.name)).toBe('guest_name');
  await page.keyboard.type('Keyboard Tester');

  for (let i = 0; (await page.evaluate(() => document.activeElement?.id)) !== 'promo-code'; i++) {
    expect(i, 'promo code field reachable with Tab').toBeLessThan(40);
    await page.keyboard.press('Tab');
  }
  await page.keyboard.type('NOTAREALCODE');
  await page.keyboard.press('Enter');
  await expect(page.locator('#promo-code-error')).toBeVisible();
  await expect(page.locator('#promo-code')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#promo-code')).toHaveAttribute('aria-describedby', 'promo-code-error');

  await tabTo(page, /Continue to Payment|Place Order/);
  await page.keyboard.press('Enter');

  // 6. Payment step: focus is moved to the new step heading.
  await expect(page.getByRole('heading', { level: 1, name: 'Payment' })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => focused(page)).toBe('Payment');

  // 7. Stripe PaymentElement (third-party iframe), keyboard only.
  const stripeFrame = page.frameLocator('iframe[title*="payment" i]').first();
  await expect(stripeFrame.locator('input').first()).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Tab'); // into Stripe's first field
  const reachedCard = await (async () => {
    for (let i = 0; i < 10; i++) {
      const name = await stripeFrame
        .locator(':focus')
        .getAttribute('name')
        .catch(() => null);
      if (name === 'number') return true;
      await page.keyboard.press('Tab');
    }
    return false;
  })();
  test.info().annotations.push({ type: 'stripe-card-field-reached-by-tab', description: String(reachedCard) });
  expect(reachedCard, 'card number field reachable with Tab').toBe(true);
  const focusedStripeField = () =>
    stripeFrame.locator(':focus').getAttribute('name').catch(() => null);
  /** Tab until Stripe's field `name` has focus (as a keyboard user would). */
  const tabToStripeField = async (name: string) => {
    for (let i = 0; i < 10 && (await focusedStripeField()) !== name; i++) {
      await page.keyboard.press('Tab');
    }
    expect(await focusedStripeField(), `Stripe "${name}" field reachable with Tab`).toBe(name);
  };
  await page.keyboard.type('4242424242424242', { delay: 30 });
  await tabToStripeField('expiry');
  await page.keyboard.type('1234', { delay: 30 });
  await tabToStripeField('cvc');
  await page.keyboard.type('123', { delay: 30 });
  // Country/ZIP fields vary by account settings; fill ZIP if it is shown.
  if (await stripeFrame.locator('input[name="postalCode"]').isVisible().catch(() => false)) {
    await tabToStripeField('postalCode');
    await page.keyboard.type('90059');
  }
  await tabTo(page, /^Pay now$/, { max: 20 });
  await page.keyboard.press('Enter');

  // 8. Tracking page after payment.
  await expect(page).toHaveURL(/\/track\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Order progress' })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
  await scan(page, 'track-order-detail');
});
