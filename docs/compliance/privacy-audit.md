# Privacy and data-collection audit

**Review date:** 2026-09-23. This was a read-only review of the repository: `backend/`, `frontend-next/`, `frontend/` (Vite), the Docker Compose files and `deploy/`. No database, AWS, Stripe or Firebase account was accessed, apart from one check against the **local** development database, described below. No secrets or customer data appear in this report.

This is a technical inventory, not legal advice. Items marked **[BUSINESS]** or **[LEGAL]** need a decision from the owner or counsel.

## Summary

1. **Critical exposure, verified.** `GET /api/orders/:id` requires no authentication. Order ids are sequential integers. Each response includes the customer's name, phone number, order notes and tracking code.
   - Verified against the local backend with keys only; no values were printed.
   - The real-time `/kitchen` socket, which has no authentication, also announces every new order id, so the exposure can be automated.
   - This must be fixed before the privacy policy says anything about security (R-1, R-2).
2. **The app collects very little.** Guest name, an optional phone number, order notes, and the order itself. Google sign-in adds name, email and account id. There are no analytics, advertising, email or SMS providers. IP addresses are not stored in the database.
3. **Stripe handling is sound.** No card data is stored. Webhooks are signature-verified, and the secret key stays on the server.
4. **Nothing is ever deleted.** Orders, payments, abandoned unpaid orders and accounts are kept forever. Backups are manual plaintext dumps with no rotation.
5. **There is no way to act on a customer's request** to access, export or delete their data.
6. The `/privacy` draft has been written from these findings. It is **not published**; section F lists what it is waiting for.

## A. Data inventory

### A1. What customers provide

| Data | Source | Required? | Guest | Signed-in | Code |
|---|---|---|---|---|---|
| Name | Checkout form (guests); Google display name (signed-in) | Yes | ✓ | ✓, copied into every order row | `checkout/page.tsx:415-416`, `sp_order_create` |
| Phone | Checkout form; Google `phone_number` claim if present | No | ✓ | rare | same; `requireFirebaseAuth.js:19-33` |
| Order notes (free text; the placeholder invites allergies) | Checkout form; also per-item `order_item.notes` via the API | No | ✓ | ✓ | `order.controller.js:20` |
| Email | Google sign-in only; not collected from guests | n/a | ✗ | ✓ | `requireFirebaseAuth.js` |
| Google account id (Firebase UID) | Google sign-in | n/a | ✗ | ✓ | `user.firebase_uid` |
| Profile photo | Shown in the browser straight from Google; **never sent to our backend** | n/a | ✗ | display only | `client-chrome.tsx`, `checkout/page.tsx` |
| Order contents, location, pickup time, promo code, totals, status history | Order flow | Yes | ✓ | ✓ | `order`, `order_item`, `order_item_option` |
| Payment reference | Stripe | Yes | ✓ | ✓ | `payment.stripe_payment_intent_id` |

**Not collected anywhere:** IP address, user agent, device fingerprint and geolocation (searched in the backend and both frontends). There is no request-logging middleware. Location is chosen from a list; the browser location API is never used.

**Staff** (out of scope for the customer policy): email, bcrypt password hash, name, phone, role and location.

### A2. Database inventory (`backend/database/schema.sql`)

| Data | Stored? | Table.column | Purpose | Retention today |
|---|---|---|---|---|
| Name | Yes | `order.guest_name`; `user.first_name`, `last_name` | Hand-over at pickup; account | Indefinite |
| Phone | Yes | `order.guest_phone`; `user.phone` | Contact about the order | Indefinite |
| Email | Yes (signed-in only) | `user.email` | Account identity | Indefinite |
| Firebase UID | Yes | `user.firebase_uid` | Link to the sign-in | Indefinite; the row is recreated on the next login |
| Order notes | Yes | `order.notes`, `order_item.notes` | Kitchen. **Staff cancel and priority reasons are appended to the same column** (`stored_procedures.sql:888-890, 931-933`) | Indefinite |
| Order history | Yes | `order`, `order_item`, `order_item_option` | Fulfilment, accounting, reorder | Indefinite. There is no order-delete procedure, and `payment` uses `ON DELETE RESTRICT` |
| Abandoned (unpaid) orders | Yes | `order` with status CREATED | None once abandoned; they are filtered out of views but never removed | Indefinite, including name, phone and notes |
| Stripe id | Yes | `payment.stripe_payment_intent_id`, plus `amount`, `currency`, `status` | Reconciliation and refunds | Indefinite |
| Stripe customer id / card data | **No** | None | None | None |
| Tracking code | Yes | `order.tracking_code` (MySQL `UUID()`, time-based v1) | Guest order lookup | Indefinite |
| Newsletter email | Table and procedures exist, but **no route uses them** | `newsletter_subscriber` | None today | None |
| Password hash | Staff only | `user.password_hash` | Staff login | Indefinite |

**Backups:** manual `mysqldump` to `~/backup-*.sql` on the production host, with no rotation (`deploy/MANUAL_DEPLOYMENT.md:105-108`).

**Possible second copy:** the orphaned `yumyum-backend` Lightsail service (us-east-1) may hold data. **[BUSINESS]** Confirm this and decommission it.

## B. Third-party inventory

| Service | Receives | Why | Required? | Analytics or marketing? |
|---|---|---|---|---|
| **Stripe** | Card details, entered in Stripe's iframe and never touching our servers. The backend sends `amount`, `currency` and `metadata.order_id` only: no name, email or receipt email (`payment.service.js:27-35`). Stripe.js collects device and fraud signals on the checkout page. | Payments and fraud prevention | Yes | No (Stripe's own fraud signals) |
| **Google Firebase Authentication** | Sign-in via Google popup; the ID token is verified by the Admin SDK | Customer sign-in (optional) | For accounts only | No. No Firestore, Analytics or Messaging |
| **AWS** (Amplify hosting; Lightsail with Docker for the API and MySQL; S3) | All traffic and the database. S3 holds only menu and promo images (`upload.service.js:54,86`). | Hosting | Yes | No |
| **Google Maps embed** (Next.js `/locations/[id]` only) | Visitor IP and Google cookies when the page loads (`locations/[id]/page.tsx`, `<iframe src="google.com/maps?...&output=embed">`) | Show the location | No | Possibly Google's own. **[LEGAL]** consent question |
| **Google Maps / Apple Maps / Waze links** | Nothing until the user clicks | Directions | No | No |
| **Google Fonts CDN** (Vite app `frontend/index.html:10-12`, **currently live**) | Every visitor's IP on every page | Font | No: the Next app self-hosts with `next/font` | No, but it is an avoidable transfer |
| **Instagram link** | Nothing until clicked | Social | No | No |
| Email, SMS, error monitoring, analytics, advertising | **None present** | None | None | None |

The earlier sub-report said Maps was "links only". That was true of the Vite app; the Next app embeds a map on location pages.

## C. Cookies and browser storage

The backend sets **no cookies**: there is no `res.cookie`, session or cookie-parser.

| Name | Provider | Type | Purpose | Duration | Category |
|---|---|---|---|---|---|
| `yumyum_cart` | The Rollecito | localStorage | Cart items and location | Until the order is placed or the data is cleared | Required |
| `yumyum_pickup` | The Rollecito | localStorage | Chosen pickup time | Removed once the time has passed | Required |
| `yumyum_guest_orders` | The Rollecito | localStorage | Last 10 tracking codes. **These act as bearer keys to name, phone and notes** (R-5) | Until cleared | Functional |
| `lang` | The Rollecito | localStorage | Language preference | Until cleared | Functional |
| `rollecito_promo_seen` | The Rollecito | localStorage or sessionStorage | Promo-modal frequency cap (campaign id to date) | Per day or per session | Functional; no personal data |
| `staff_token`, `staff_user` | The Rollecito | localStorage | Staff JWT (12 h) and profile | 12 h token | Required (staff only). XSS-readable (R-12) |
| `staff_session_expired` | The Rollecito (Vite) | sessionStorage | Session-expiry notice | Session | Required (staff) |
| `firebaseLocalStorageDb` | Google Firebase | IndexedDB | Customer sign-in session | Until sign-out | Required for accounts |
| `__stripe_mid`, `__stripe_sid` | Stripe | First-party cookies set by Stripe.js on checkout | Fraud prevention | 1 year / 30 min (Stripe's documented values) | Required (payments) |
| Google cookies (e.g. `NID`) | Google | Third-party, via the Maps iframe | Google's purposes | Google-controlled | Third-party |

**Consent assessment.** Everything first-party is strictly necessary or functional, and nothing is used for analytics or advertising. Stripe's cookies are for fraud prevention on a payment page. The one item that may need consent in some jurisdictions is the **Google Maps embed**.

Options:
- **(a)** Replace it with a static map image, or a "Show map" button that loads the iframe on click. This is recommended, and removes the need for any banner.
- **(b)** Add a consent step for it.

**No cookie banner was implemented**, as instructed; the need depends on the decision above. **[LEGAL]**

## D. Stripe review

- **No PAN, CVV, expiry or last-4 stored.** The `payment` table holds only the intent id, amount, currency and status.
- **The secret key is server-side only** (`config/stripe.js`). `/payments/status` returns only the publishable key, and neither frontend's env files contain any Stripe key.
- **Webhooks** are verified with `stripe.webhooks.constructEvent` over the raw body (`app.js:31`, `payment.service.js:51-55`).
- **The `/payments/confirm` fallback** re-fetches the PaymentIntent from Stripe and matches `metadata.order_id`.
- **`client_secret`** is never logged or placed in our URLs. Stripe appends `payment_intent_client_secret` to `return_url` only for redirect-based methods, which is standard.
- **Weakness:** `POST /payments/create-intent` returns a `client_secret` for any CREATED order id without auth (Low, R-14).
- **Payment flow unchanged** in this work.

## E. Risks and required code changes

Status for all of these: **not implemented in this phase.** They are backend or authorization changes that affect the live Vite app. See "Why not fixed now" below.

| # | Sev. | Risk | Evidence | Recommended change |
|---|---|---|---|---|
| R-1 | **Critical** | Anyone can enumerate `GET /api/orders/:id` and `GET /api/orders/:id/items` and receive name, phone, notes, `tracking_code` and `user_id`. | `order.routes.js:67-79`; `sp_order_get` (`stored_procedures.sql:839-853`); verified locally | Require staff auth on `/:id`, or return only non-personal fields. Customers already have `/track/:code`. The confirmation page and the tracking page's `/:id/items` call must switch to code-based lookups. |
| R-2 | **Critical** | The `/kitchen` socket needs no auth; any client can join `location_{id}` and receive every order id, and staff priority `reason` text. Chained with R-1, this is a live feed of personal data. | `sockets/index.js:24-31`; `order.service.js:121-127` | Authenticate staff sockets with the JWT. Give customers a per-order room keyed by tracking code, receiving status only. |
| R-3 | High | `user_id` in the `POST /orders` and `/promotions/preview` bodies is trusted, which allows attributing orders to other users and enumerating user ids. | `order.controller.js:7`, `promotion.controller.js:33` | Take `user_id` from the verified Firebase token, never from the body. |
| R-4 | High | The unhandled-error handler logs the whole error object, including Stripe signature errors with the raw webhook payload, Stripe `raw`, and SQL text. | `errorHandler.js:33` | Log `err.name`, `err.message`, `err.code`, the route and a request id; strip `payload`, `raw`, `sql` and `params`. |
| R-5 | High | The public tracking endpoint returns the **full phone number** and notes. Codes are time-based UUID v1, and there is no rate limit. | `stored_procedures.sql:447, 951-966` | Mask the phone (`•••-•••-9202`); drop `user_id` and staff notes; use random UUID v4 (`UUID_TO_BIN(UUID())` or generate in Node); add a rate limit. |
| R-6 | High | No retention at all. Abandoned CREATED orders keep name, phone and notes forever; backups are unrotated plaintext. | `schema.sql`; `MANUAL_DEPLOYMENT.md:105-108` | Scheduled anonymization job (section G); encrypted, rotated backups. |
| R-7 | High | There is no customer access, export or deletion path. Staff delete procedures accept client rows but leave personal data in orders and never delete the Firebase user. | `sp_staff_delete` (`stored_procedures.sql:174-185`) | Admin "export client" and "anonymize client" actions (section H). |
| R-8 | High | The production MySQL root password is committed in `docker-compose.prod.yml:39,72`, and the backend connects as `root`. | Tracked file | Rotate it; move it to `.env`; use a least-privilege `EXECUTE`-only user, as the README intends. |
| R-9 | Medium | Staff and managers are not scoped to their location on kitchen and dashboard endpoints, which carry personal data. | `kitchen.controller.js:8`, `dashboard.controller.js:10` | Enforce `req.user.location_id` for non-admins. |
| R-10 | Medium | No rate limiting on login, tracking, order creation or promos. | `app.js` | `express-rate-limit` on those routes. |
| R-11 | Medium | Staff cancel and priority reasons are appended to `order.notes`, which is publicly readable through R-1 and R-5. | `stored_procedures.sql:888-890, 931-933` | Move them to a staff-only column. |
| R-12 | Medium | The staff JWT is in localStorage (readable by any XSS). | `staff-auth-provider.tsx:54` | httpOnly cookie, or shorter tokens plus a CSP. |
| R-13 | Medium | Order notes invite allergy details, which can count as health information under some laws. | Checkout placeholder | **[LEGAL]** Keep, reword, or add a notice. |
| R-14 | Low | Public `create-intent` returns a client secret for any CREATED order. | `payment.routes.js:11-18` | Bind it to the creating session, or require the tracking code. |
| R-15 | Low | Personal data in query strings (`?search=` in admin client search and kitchen history) can land in proxy logs. | `user.controller.js:41`, `kitchen.controller.js:42` | Use POST for search, or scrub the logs. |
| R-16 | Low | Google Fonts CDN on the live Vite app. | `frontend/index.html:10-12` | Self-host, as the Next app already does. |
| R-17 | Low | The Google Maps embed loads on every location-page view. | Next `locations/[id]` | Click-to-load (section C). |
| R-18 | Low | No log rotation for Docker. | compose files | `logging: { driver: json-file, options: { max-size, max-file } }` |
| R-19 | Low | The signed-in display name is duplicated into `order.guest_name`. | `checkout/page.tsx:416` | Acceptable for hand-over; it just needs to be included in anonymization. |
| R-20 | Low | Orphaned `yumyum-backend` service; the Lightsail script falls back to CORS `*`. | `MANUAL_DEPLOYMENT.md:17-27`, `lightsail-backend.sh:187` | Decommission it. |

Also noted in the repo: `frontend/.env` and `.env.production` are tracked. They contain only public Firebase web config and public URLs (confirmed without printing values). `firebase-service-account.json` was never committed. No `sk_`, `whsec_` or private-key strings appear anywhere in git history.

**Why not fixed now.**
- R-1 to R-5 change API contracts that the **live Vite frontend** relies on: its confirmation page calls `GET /orders/:id`, and its tracking page reads the socket.
- The brief also says not to make major business-logic changes without documenting them first.
- These are documented here with a concrete change for each and are ready to implement. The recommended first step is a short PR for R-1 plus the matching frontend calls in both apps.

## F. Draft privacy policy

- **Route:** `frontend-next/src/app/(marketing)/privacy/page.tsx`. View it with `npm run dev` at `http://localhost:3000/privacy`.
- **Publishing gate:** `legal.privacyPolicyPublished` in `src/lib/config/legal.ts`. While it is `false`:
  - the route returns **404 in production builds** (verified);
  - it is `noindex` and absent from the sitemap;
  - the footer and checkout links to it are hidden.
- **Going live:** set the flag to `true`. That one change turns on the footer link, the checkout "How we use these details" link and the sitemap entry.
- **Content:** every statement was written from sections A–D. Each gap is shown on the page as a highlighted `[BUSINESS INPUT REQUIRED: …]` marker. The page covers all 13 required sections plus a "Who we are" section.

Marked for input:

1. Legal business name, entity type and address.
2. Effective date and last-updated date.
3. Whether reverse-proxy or web-server access logs record IP addresses, and how long they are kept.
4. Whether and how staff contact customers (e.g. phone).
5. Confirmation that there is no marketing use.
6. Google Fonts line: keep or remove depending on which frontend is live.
7. Confirmation that no personal information is sold or shared for cross-context advertising.
8. Consent requirement for the Maps embed.
9. All retention periods (section G).
10. Security section: **hold until R-1 and R-2 are fixed**, then confirm HTTPS and encryption at rest.
11. Applicable laws and rights, with response times (section H).
12. Children's policy.
13. How significant changes are communicated.
14. Confirmation that `hello@therollecito.com` is the privacy inbox.

**Deliberately not claimed:** "we never share data", "all data is encrypted", CCPA applicability, specific legal rights, or retention periods.

## G. Retention recommendations (**[BUSINESS] + [LEGAL] approval required; nothing implemented**)

| Category | Why it is kept | Recommended starting point | Then |
|---|---|---|---|
| Completed orders and payments | Accounting, tax, chargebacks | Keep the financial fields for the tax period your accountant specifies (commonly 7 years in the US) | After **90 days**, anonymize `guest_name`, `guest_phone` and `notes`; keep items, totals and the Stripe id |
| Abandoned CREATED orders | None | **7 days** | Delete the order rows, or anonymize them; cancel any open PaymentIntent |
| Customer accounts (signed-in) | Order history, reorder | While active; after **24 months** without login, notify and then delete | Delete the `user` row, delete the Firebase user, anonymize linked orders |
| Payment references | Refunds and disputes | Same as the financial fields | Stripe keeps its own records under its policy |
| Server and container logs | Debugging, security | **30 days**, with Docker rotation | Rotate and delete |
| Database backups | Recovery | **30 days**, encrypted, off the host | Rotate |
| Guest tracking codes in the browser | Convenience | Already capped at 10; add a **90-day** expiry | Client-side pruning |
| Authentication sessions | Sign-in | Firebase default (until sign-out); staff JWT 12 h | No change |

Implementation, once approved: a nightly job using a MySQL `EVENT` or a Node cron in the backend container. It should run through stored procedures, as the rest of the data layer does, and be tested against a copy of the database first. **Never run it against production without a verified backup.**

## H. CCPA / CPRA: capabilities today and gaps

Whether CCPA/CPRA applies depends on revenue and volume thresholds that the code cannot show. **[LEGAL]** Regardless of that answer:

| Capability | Today | Needed if rights apply |
|---|---|---|
| Right to know or access | An admin can view a client's profile and order history in the dashboard (`user.routes.js:20-34`). Guests have no path. | "Export client data" (JSON) admin action; a verification process for guests (e.g. tracking code plus phone) |
| Delete | None safe (R-7) | "Anonymize client" procedure: scrub personal fields on `user` and linked orders, delete the Firebase Auth user, keep the financial fields |
| Correct | None | An admin edit of name and phone |
| Opt out of sale or sharing | Not applicable technically: no advertising, analytics or data brokers | **Do not add a "Do Not Sell" link** unless counsel determines that sale or sharing occurs. Re-evaluate if analytics or advertising are added. |
| Sensitive personal information | Possibly allergy text in notes (R-13) | Counsel to decide |
| Request intake | `hello@therollecito.com` | Log requests and track the 45-day response window |

## I. Privacy UX review

- Checkout asks only for a name (required) and a phone number (optional, now labelled so). Notes are optional. Email is not requested from guests. **No unnecessary fields.**
- A "How we use these details: Privacy Policy" link sits under "Your information" at checkout. It appears automatically once the policy is published.
- Footer: **Accessibility** is live. **Privacy Policy** appears when the policy is published. **Terms** is not linked, because no terms page exists and a link to a 404 is worse than none. It is planned for a later compliance phase.
- The tracking page shows the customer's name to anyone holding the link. The draft policy tells users to share the link only with people they trust; R-5 reduces what the link reveals.
- The new customer pages (`/cart`, `/checkout`, `/track/*`, `/profile`, `/order-confirmation`) are now `noindex`, so tracking URLs are less likely to end up in search engines.
