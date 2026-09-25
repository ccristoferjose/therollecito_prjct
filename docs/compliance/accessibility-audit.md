# Accessibility audit: WCAG 2.2 Level AA (customer journey)

- **Review date:** 2026-09-23
- **Codebase reviewed:** `frontend-next/` (the Next.js app that `amplify.yml` deploys). At the time of review, `deploy/MANUAL_DEPLOYMENT.md` names the Vite app in `frontend/` as the live site. **None of these fixes reach customers until the Next.js cutover.** Section C covers the Vite app.
- **Standard:** WCAG 2.2 Level AA. This report makes no claim of conformance or of "ADA compliance". Automated scans passing is not legal compliance.

## Summary

- **Scope:** every customer-facing step: landing, locations, location choice, pickup time, menu, product details and options, cart, promo codes, checkout, Stripe payment, confirmation and tracking, plus the profile page, the promotional modal and the 404 page.
- **Issues found:** 41 in total: 4 Critical, 13 High, 17 Medium and 7 Low (Section A).
- **Fixed:** 35 of the 41, including all 4 Critical, mostly without visible change.
  - The visible changes are small and each is listed in Section B2.
  - Pixel comparison against the untouched build: desktop pages changed by 0.02–0.15% of pixels.
  - Mobile pages are 32px taller because of the new footer link.
- **Still open:** brand-colour contrast, which needs a design decision; VoiceOver testing, which a person must run; and the items in Section C.

## A. Issues found

Severity scale:

- **Critical:** blocks a task for keyboard or screen-reader users.
- **High:** a major barrier or a clear AA failure on the purchase path.
- **Medium:** an AA failure with a workaround, or a failure off the main path.
- **Low:** best practice or minor.

| # | Page / component | Problem | WCAG | Sev. | Status |
|---|---|---|---|---|---|
| A-1 | `/order`, location list | Location cards were `<div onClick>`: not focusable and not announced as controls. A keyboard user landing on `/order` could not choose a location. | 2.1.1, 4.1.2 | Critical | Fixed. The location name is a `<button>`, and its `::after` stretches over the card so mouse users can still click anywhere. |
| A-2 | Shared `Modal` (product, pickup time, change location, directions, reorder) | No `role="dialog"` or accessible name. Focus was not moved in, not kept in, and not returned on close. No Escape to close. Keyboard users kept tabbing through the page behind the dialog. | 2.1.2, 2.4.3, 4.1.2 | Critical | Fixed. New `useDialogFocus` hook; `role="dialog"`, `aria-modal`, and `aria-labelledby` pointing at the title. |
| A-3 | Promotional modal (landing) | Opens by itself over the page, but focus was never moved into it, trapped or restored. | 2.4.3, 2.1.2 | Critical | Fixed (same hook). |
| A-4 | Header, phones (<640px) | The Track, Locations, Profile and Cart links hid their text with `display:none`, leaving four links with no name. The language button was announced only as a flag emoji. | 2.4.4, 4.1.2 | Critical | Fixed with `sr-only sm:not-sr-only`. Visually identical. |
| A-5 | Menu product cards | The whole card was a `<div onClick>`. The "Add" button inside only worked because its click bubbled up. Every item's button was named just "Add". | 4.1.2, 2.4.6 | High | Fixed. "Add" is the real control, named "Add {product}" (still contains the visible word, per 2.5.3), with `aria-haspopup="dialog"` and a stretched hit area. |
| A-6 | Menu page, pickup time | After choosing a time, the menu refetch replaced the whole page with a spinner. That unmounted the picker, so focus fell to the top of the page. Found by the keyboard test. | 2.4.3 | High | Fixed. The full-page spinner shows only on the first load (`useFetch` now returns `settled`); later refetches swap only the menu area. |
| A-7 | Nested controls | `<Link><Button>` combinations (cart, checkout, empty cart, tracking, confirmation, profile) and a Reorder `<button>` inside a card `<Link>`. Each gave two tab stops for one action and an invalid "link, button" announcement. The cart's disabled button inside a link still navigated when pressed with Enter. | 4.1.2, 2.4.3 | High | Fixed. New `buttonVariants()` styles a single `<Link>`. The profile cards use a stretched link, with Reorder layered above it. |
| A-8 | No bypass mechanism | No "skip to content" link; about 8 header controls on every page. | 2.4.1 | High | Fixed. A skip link appears only on keyboard focus, in both layouts. |
| A-9 | Focus visibility | Buttons used `focus:outline-none` plus an `accent/50` ring (1.42:1). The location select had no focus style at all. | 2.4.7, 1.4.11 | High | Fixed. Global two-tone `:focus-visible` ring: dark outline over a cream gap, visible on light and dark backgrounds. Keyboard only, so mouse users see no change. |
| A-10 | Checkout, promo code | The label was not associated with the input. The error was not announced and was not linked to the field. Error text contrast was 3.09:1. | 1.3.1, 3.3.1, 4.1.3, 1.4.3 | High | Fixed. `<label for>`; `aria-invalid`; `aria-describedby`; `role="alert"`; text-safe error colour. |
| A-11 | Checkout errors | Order and payment errors were plain `<div>`s that screen readers never announced. Error text was 3.09:1. | 4.1.3, 3.3.1, 1.4.3 | High | Fixed (`role="alert"`, `--color-error-text`, 5.72:1). |
| A-12 | Brand primary `#A86A4A` | Cream text on primary buttons is 3.91:1; white text on primary chips and slots is 4.35:1; primary-coloured links and prices on cream are 3.91:1. The landing page's 70%-opacity body text is 3.73–4.22:1. | 1.4.3 | High | **Open, needs a design decision.** See C-1. |
| A-13 | Order tracking | No `h1` on the page. The status timeline showed the current step only by fill colour. Status changes were silent for screen-reader users. | 1.3.1, 1.4.1, 4.1.3 | High | Fixed. The status is now the `h1`. The timeline is an `<ol>` with `aria-current="step"` and spoken "completed / current step / not started". Changes are announced through a live region. |
| A-14 | Checkout, special-instructions textarea | Its placeholder was its only label. | 3.3.2, 1.3.1 | High | Fixed with a visually hidden label. A visible label is recommended (C-3). |
| A-15 | Cart and add-to-cart | Adding, removing or changing quantity gave screen-reader users no feedback: the dialog closes and the badge changes out of view. The quantity buttons were named "Increase quantity" with no product name. | 4.1.3, 2.4.6 | High | Fixed. `AnnouncerProvider` polite live region; per-product control names; each row is a named group. |
| A-16 | Page titles | Cart, checkout, tracking, profile and confirmation all had the site's default title. | 2.4.2 | High | Fixed with pass-through `layout.tsx` metadata. Those pages are also marked `noindex`: tracking URLs contain order codes. |
| A-17 | Location-detail CTA, marketing "Order online", promo CTA, 404 CTA | Cream text on accent orange: 1.85:1. | 1.4.3 | High | Fixed. Dark text on accent, the treatment the app's own `accent` button already used (5.23:1). |
| A-18 | Cart "not available at this time" note; tracking item notes | Warning-orange and accent text: 2.06:1. | 1.4.3 | Medium | Fixed (`--color-warning-text`, 5.91:1). |
| A-19 | Landing "Two menus, one kitchen" pill | Orange on a tinted background: 2.56:1. | 1.4.3 | Medium | Fixed (`--color-accent-text`, 5.15:1). |
| A-20 | Pickup and checkout time slots, menu categories | The selected option was shown only by colour. | 1.4.1, 4.1.2 | Medium | Fixed (`aria-pressed`, and named `role="group"` for each group). |
| A-21 | Product options | Checkbox groups had no group name, and the "Required" badge was not tied to the group. | 1.3.1 | Medium | Fixed (`<fieldset>`/`<legend>`). |
| A-22 | Checkout form | No `autocomplete` on name or phone. Optional fields were not marked. | 1.3.5, 3.3.2 | Medium | Fixed (`autocomplete="name"`/`"tel"`; "Phone (optional)"). |
| A-23 | Shared `Input` | The id was a slug of the label (collides, and changes with language). Errors were not linked to the field. | 1.3.1, 3.3.1 | Medium | Fixed (`useId`, `aria-describedby`, `aria-invalid`). |
| A-24 | Checkout, payment step | Moving from the info step to payment left focus on a removed button. | 2.4.3 | Medium | Fixed. Focus moves to the step's `h1`. |
| A-25 | Heading levels | `h3` under `h1` on menu and cart; `h4` for the footer groups; `EmptyState` fixed at `h3`. | 1.3.1 | Medium | Fixed. Same styling, correct levels. |
| A-26 | Landmarks | Neither the header nav nor the footer links were labelled or in a `<nav>`. | 1.3.1, 2.4.1 | Medium | Fixed ("Main", "Quick Links", "Legal"). |
| A-27 | Language | Choosing Spanish on the marketing pages set `<html lang="es">` although only the footer is translated. The "Español" button had no `lang`. | 3.1.1, 3.1.2 | Medium | Fixed. `lang` is scoped to the footer; the button carries `lang`. |
| A-28 | Spinners | Loading states were silent. | 4.1.3 | Medium | Fixed (`role="status"` plus text; decorative inside labelled buttons). |
| A-29 | Profile reorder toast | The toast was not announced. | 4.1.3 | Medium | Fixed (polite live region). |
| A-30 | Reflow at 320px / 200% zoom | The landing page scrolled sideways by 9px, from the rotated card behind the mascot. The client header was 2px too wide at 320px when the cart had items. | 1.4.10 | Medium | Fixed (`overflow-x-clip` on that section; header link padding tightened below 360px only). |
| A-31 | Remove-promo button | 22×22px. | 2.5.8 | Medium | Fixed (26px). |
| A-32 | Product images | `alt={item.name}` directly above the same name as a heading, so screen readers read every product twice. The 🥐 placeholder was read aloud. | 1.1.1 | Low | Fixed (`alt=""`, emoji `aria-hidden`). |
| A-33 | Landing "Order" links (×4) | Identical link text for different products. | 2.4.4 | Low | Fixed (visually hidden product name). |
| A-34 | External links (Instagram, maps, directions) | Opening a new tab was not announced. | 3.2.5 (AAA) / best practice | Low | Fixed. |
| A-35 | Motion | The floating mascot and hover lifts ignored "reduce motion". | 2.3.3 (AAA) / best practice | Low | Fixed (`prefers-reduced-motion`). |
| A-36 | Pickup button label | "Choose a time" now has a longer accessible name that still contains the visible words. | 2.5.3 | Low | Fixed. |
| A-37 | Processing fee | The explanation is only in a hover `title`. | 1.3.1 | Low | Open (C-5). |
| A-38 | Required product options | The "Required" badge is shown, but "Add to Cart" works without choosing one. There is no error prevention. | 3.3.1 / 3.3.4 | Medium | **Open, business logic.** The backend is not verified to enforce it. |
| A-39 | Spanish translation | Checkout, pickup, cart messages and the new announcements are partly English only. Spanish users hear mixed languages. | 3.1.2 | Medium | Open (C-4). |
| A-40 | Track lookup | Labelled "Order Number", but it expects the UUID tracking code. | 3.3.2 | Low | Open (C-6). |
| A-41 | Staff, admin and kitchen screens | 26 jsx-a11y errors: unassociated labels, clickable `<div>`s, `autoFocus`. | various | Medium | Out of scope; lint warnings (C-7). |

## B. What changed

### B1. Files

Shared components:

- `src/components/ui/`: `modal.tsx`, `button.tsx` (new `buttonVariants`), `input.tsx`, `spinner.tsx`, `empty-state.tsx`, `lang-switcher.tsx`
- `src/lib/hooks/use-dialog-focus.ts` (new)
- `src/lib/hooks/use-fetch.ts` (adds `settled`)
- `src/providers/announcer-provider.tsx` (new), `src/providers/lang-provider.tsx`
- `src/components/layout/`: `skip-link.tsx` (new), `client-chrome.tsx`, `site-footer.tsx`
- `src/app/globals.css`: focus ring, reduced motion, and three text-safe colour tokens
- `src/lib/i18n/{en,es,index}.ts`: a11y strings in both languages and a `fmt()` helper

Pages:

- `src/features/order/order-client.tsx`
- `src/features/service-period/pickup-picker.tsx`
- `src/features/tracking/track-page.tsx`
- `src/features/promo-campaign/promotional-modal.tsx`
- `src/app/(client)/{cart,checkout,profile,order-confirmation/[orderId]}/page.tsx`
- New `layout.tsx` for page titles in cart, checkout, track, profile and order-confirmation
- `src/app/(marketing)/{layout,page,locations/[id]/page}.tsx`, `src/app/not-found.tsx`

Compliance:

- New: `src/app/(marketing)/accessibility/page.tsx`, `src/app/(marketing)/privacy/page.tsx`, `src/lib/config/legal.ts`
- `sitemap.ts`

Tooling:

- `eslint.config.mjs`: full jsx-a11y recommended set
- `playwright.config.ts`, `tests/a11y/*`, `package.json` (`test:a11y` script and 3 dev dependencies)
- `.gitignore`

No backend, database or payment-flow code was changed. Stripe is still loaded and confirmed exactly as before.

### B2. Visible changes, and why each was needed

Every other change is invisible: markup, ARIA, focus behaviour, or text visible only to screen readers.

1. **Keyboard focus ring:** dark outline with a cream gap. It appears only on keyboard focus (`:focus-visible`). Mouse users no longer see the old faint ring after clicking a button. (2.4.7, 1.4.11)
2. **Skip link:** appears only when focused with Tab. (2.4.1)
3. **Error and warning text colours** darkened within the same hue: `#B3401F` (error) and `#8A5A12` (warning). Used for message text only; fills and borders are unchanged. (1.4.3)
4. **Four orange CTAs** use dark text instead of cream: marketing "Order online", location "Order & pick up here", the promo button, and the 404 "Back home". This matches the existing `accent` button style. (1.4.3)
5. **"Two menus, one kitchen" pill:** slightly deeper orange text. (1.4.3)
6. **Tracking item notes:** amber instead of light orange. (1.4.3)
7. **Footer:** new "Accessibility" link in the bottom row, which wraps to its own line on phones (+32px). "Privacy Policy" appears there automatically once approved. (Required by this phase.)
8. **"Phone (optional)"** label on checkout. (3.3.2)
9. **Remove-promo ×** button: 4px larger. (2.5.8)
10. **Profile past-order cards** now have the 12px gap the markup always intended. The old `<Link>` wrapper was inline, so `space-y-3` never applied.
11. **Header icon padding** is slightly tighter below 360px width only. (1.4.10)
12. **Reduced motion:** users with the OS setting on no longer see the float or hover animations.
13. **Menu refetch:** changing the pickup time shows the spinner in the menu area instead of blanking the page.
14. **Owner-requested, not an accessibility fix:** the landing page's "For business owners" pitch section was removed. A small "Powered by Christtopher Chitay · Contact" line (a mailto link with a prefilled subject and body) now sits in the footer's bottom row on every page.

## C. Remaining issues and decisions needed

| # | Needs | Item |
|---|---|---|
| C-1 | **Design decision** | The brand primary `#A86A4A` fails AA for normal-size text in several places (A-12). Recommended: darken the `--color-primary` token to **`#996043`** (9% darker, same hue), which measures 4.59:1 on cream and 5.11:1 on white. This one-line token change fixes every remaining axe finding except the logo, which is exempt. Also raise the landing page's `text-primary-dark/70` to `/80`. The test suite lists `color-contrast` in `KNOWN_OPEN_RULES`; remove it once this is decided. |
| C-2 | **Person with a Mac/iPhone** | Run the VoiceOver script (Section D2). I cannot operate a screen reader. The accessibility tree was checked in Chrome, but that does not replace a real VoiceOver pass. |
| C-3 | Design | Add a visible "Special instructions (optional)" label above the notes field; it is visually hidden today. |
| C-4 | Business / content | Finish the Spanish translation of checkout, pickup, cart and tracking, or scope the language switcher to translated pages. |
| C-5 | Design | Show the processing-fee explanation as text, not only as a hover tooltip. |
| C-6 | Content | Rename the track lookup field to "Tracking code" and show where to find it. |
| C-7 | Next phase | Staff, admin and kitchen screens: 26 jsx-a11y findings, downgraded to warnings in `eslint.config.mjs`. |
| C-8 | Business logic | Required product options are not enforced before "Add to Cart" (A-38). Confirm what the backend does before changing it. |
| C-9 | Third party | The Stripe Payment Element is Stripe's own accessible iframe. It was reachable and fillable by keyboard, and its validation errors were exposed as `role="alert"`. The Google Maps embed is third-party; the address is also given as text on the page. |
| C-10 | **Production app** | The Vite app in `frontend/`, which is live now, has none of these fixes. Either complete the Next.js cutover, or port the Critical items (A-1 to A-4) to the Vite app. |
| C-11 | Legal / business | Approve the wording of `/accessibility`, especially the offer to help customers who cannot order online. The page does not claim conformance or certification. |
| C-12 | Legal | The landing page shows a "4.9 average rating" and three named testimonials. Confirm they are real and substantiated (FTC endorsement rules). |
| C-13 | Dev experience | Observed during testing: in `next dev` only, a cart saved in localStorage came back empty after a full reload, while the production build kept it. This fits a React StrictMode double-effect race between the cart's hydrate and save effects. It is not an accessibility issue and is not proven beyond that observation. |

## D. Test results

### D1. Automated (`npm run test:a11y`, against a production build with a local backend and a Stripe **test** key)

All 11 tests pass.

| Test | Result |
|---|---|
| **axe-core 4.13, WCAG 2.0/2.1/2.2 A and AA, 18 page states** (landing; locations; location detail; choose location; menu; product dialog; pickup dialog; cart; empty cart; checkout; checkout with promo error; track lookup; track not found; tracked order after payment; profile; `/accessibility`; `/privacy` (a 404 in production); 404) | 0 violations except `color-contrast`, which is the brand primary (C-1) and the logotype (exempt). Before this work, the equivalent pages also failed rules including dialog name, link name, nested interactive, heading order and label. |
| **Keyboard-only purchase** (no mouse at any step) | Pass. Every assertion below held. |
| **Reflow: 320 CSS px** (= 400% zoom) | Pass. No horizontal scroll on landing, menu, cart, checkout, track or `/accessibility`. |
| **200% zoom** (640px, deviceScaleFactor 2) | Pass. Same pages. |
| **jsx-a11y lint, customer code** | 0 errors. Staff screens have 48 warnings (C-7). |
| **Visual regression** against the untouched build (10 pages × desktop and mobile) | Desktop: 0.02–0.15% of pixels changed. Mobile: pages are +32px taller from the footer link, and the landing page is no longer 399px wide on a 390px screen. |

The keyboard-only purchase test covers each step of the journey in order:

1. Skip link, then focus moves to `<main>`.
2. Choose a location.
3. The pickup-time dialog opens with focus inside. Choose tomorrow at 9:00; focus returns to the opener and the choice is announced.
4. The product dialog opens. Focus stays inside for 40 Tabs. Escape returns focus to "Add {product}".
5. Tick an option with Space, then Add to Cart; the add is announced.
6. The header Cart link reads "Cart (1 item in cart)".
7. Increase the quantity; the change is announced.
8. Checkout:
   - An empty required name keeps focus on the field.
   - An invalid promo code sets `aria-invalid`, links the error and announces it.
   - Continue moves focus to the "Payment" `h1`.
9. Stripe:
   - The card, expiry, CVC and ZIP fields are all reached with Tab.
   - A missing expiry raised a `role="alert"` error.
   - Pay now completes the test payment.
10. The tracking page has an `h1` and the timeline has `aria-current="step"`; it passes axe.

### D2. VoiceOver: **not yet performed**

To be run on macOS Safari with VoiceOver (Cmd+F5), and on iOS Safari. Record the result of each step.

1. Open `/`. Use VO+U to open the rotor and check the landmarks (banner, Main nav, main, Quick Links, Legal, contentinfo) and headings (one `h1`).
2. Tab: "Skip to main content" should be the first stop.
3. Go to `/order`. Choose a location; it should read "{name}, button, {address}".
4. "Choose a time for pickup". The dialog title should be read on open. Choose a day and a time; you should hear "Pickup time set to …".
5. Category chips: each should read "selected" or "not selected" (pressed state).
6. "Add {product}". In the dialog, each option should read its group name ("Size, Required"). Add it; you should hear "{product} added to cart. 1 item in cart."
7. In the cart, "Increase quantity of {product}" should give "{product}: quantity 2."; "Remove {product} from cart" should announce the removal.
8. At checkout, submit empty; the name field should be announced as required/invalid. Enter a bad promo code; the error should be read.
9. Continue; focus should land on the "Payment" heading. Complete the Stripe test card: 4242 4242 4242 4242, any future date, any CVC.
10. Tracking: the `h1` gives the status. In the progress list, the current step should be read as "current step". Change the order status from the kitchen screen; you should hear "Order status updated: …".
11. On iOS, repeat steps 3–9 with swipe navigation, and check that the header icons are named.

### D3. Manual checks done

- Colour contrast measured for all 32 palette pairings in use (script in the session notes). The failures are recorded in A-12 and A-17 to A-19.
- The accessibility tree of every page was inspected through Playwright snapshots.
- Before and after footer screenshots were compared by eye.

## E. Keeping it accessible

- `npm run lint` fails on new jsx-a11y violations in customer code.
- `npm run test:a11y` runs before a release. It needs `npm run dev` or `next start` plus the backend with a **Stripe test key**, because it places a test order. Never point it at production.
- New dialogs must use `Modal` or `useDialogFocus`.
- Style links with `buttonVariants()`; never wrap `<Button>` in `<Link>`.
- Status messages go through `useAnnounce()`.
- Colour tokens for message text: `error-text`, `warning-text`, `accent-text`.
