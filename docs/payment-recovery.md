# Payment confirmation and recovery

Checkout sends redirect payment methods to `/track/<tracking_code>` through
Stripe's `return_url`. There is no separate confirmation page. Nonredirect
payments go to the same tracking page after backend confirmation. If that
confirmation fails or the payment is processing, checkout includes the intent
ID so tracking can retry verification.

Tracking calls `/api/payments/confirm` with the order ID obtained from the
tracking code and the returned intent ID. The backend retrieves the intent from
Stripe, checks its order metadata, currency and received amount, and records a
successful payment. The URL's `redirect_status` is never proof of payment.
After confirmation, tracking removes all Stripe return parameters, saves the
guest tracking code and clears the cart.

Customers see “Awaiting payment confirmation” for CREATED orders. Processing
payments and confirmation/network failures offer “Check payment again” and
are checked again on the tracking page's regular poll. They must not be invited
to pay again when a charge might exist. A verified `requires_payment_method`
or `canceled` intent offers checkout again and preserves the cart.

Cancellation through the order API checks Stripe even for CREATED orders.
It scans paginated PaymentIntents from before order creation, matches
`metadata.order_id`, cancels unfinished intents and refunds successful charges.
Processing or uncaptured payments block cancellation for manual review.
Refund requests use a stable idempotency key. Already fully refunded charges
are recorded without issuing a second refund. Stripe lookup/refund errors
prevent order cancellation. Scanning old orders can be slow; persisting intent
IDs when they are created is a future improvement.

Refunds are not triggered by browser navigation or a failed confirmation request.
A charge should be refunded when the order is being canceled, not simply
because its confirmation request timed out. The existing payment schema records
both accepted pending refunds and completed refunds as `refunded`; check Stripe
for the final outcome of pending refunds.

## Live incident checklist

1. For order 129, find Stripe PaymentIntents with `metadata.order_id = 129`.
   Verify the charge and refund status. Use the updated order cancellation API
   after deployment, or refund in Stripe first and then cancel the database
   order. Direct `sp_order_cancel` calls do not execute refund checks.
2. Check Stripe's failed `payment_intent.succeeded` delivery. The endpoint must
   be the public backend `/api/payments/webhook`, subscribed to that event,
   with the endpoint's signing secret in `STRIPE_WEBHOOK_SECRET` for the correct
   live/test environment. Inspect the HTTP response and backend logs, repair
   the cause, and resend the delivery for orders that should still be fulfilled.
3. Review CREATED orders older than ten minutes against Stripe. Abandoned
   checkouts must be distinguished from succeeded or processing payments.

## Validation

Run `node --test backend/tests/payment.service.test.js` and, in `frontend-next`,
`npm run type-check`.

Before release, use Stripe test mode to exercise an Amazon Pay/redirect return
with webhook delivery disabled, a normal card payment, a processing return,
a failed payment, and a temporary confirmation API failure. Verify that only
server-confirmed payments enter the kitchen dashboard, retrying confirmation
does not charge again, successful returns clear Stripe URL parameters, and
canceling a charged CREATED order refunds its charge. No live Stripe mutations
are performed by these automated tests.
