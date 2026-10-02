import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { legal, showPrivacyLink } from '@/lib/config/legal';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'The terms that apply when you order from The Rollecito online, for pickup or delivery.',
  alternates: { canonical: '/terms' },
};

// Written from how the ordering site actually behaves (pickup, scheduled
// orders, third-party courier delivery, quoted delivery fees, the processing
// fee, promo codes, staff-issued refunds). It is a plain-language draft, not
// legal advice: the business should have it reviewed by counsel, and update
// `legal.termsUpdatedOn` whenever the text changes.

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl font-bold text-primary-dark">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

const list = 'list-disc space-y-2 pl-6';
const link = 'font-semibold text-primary-dark underline';

export default function TermsPage() {
  const updated = formatDate(legal.termsUpdatedOn);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 leading-relaxed text-text">
      <h1 className="text-3xl font-extrabold text-primary-dark">Terms of Use</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Last updated: <time dateTime={legal.termsUpdatedOn}>{updated}</time>
      </p>

      <div className="mt-8 space-y-10">
        <Section id="agreement" title="1. About these terms">
          <p>
            These terms apply when you use The Rollecito website to browse our menu, place an order for
            pickup or delivery, or track an order (&ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo;
            mean The Rollecito). By placing an order you agree to these terms. If you do not agree,
            please do not use the website to order.
          </p>
        </Section>

        <Section id="orders" title="2. Placing an order">
          <ul className={list}>
            <li>
              You can order as a guest or while signed in. Please give us a name and, for delivery, a phone
              number where you can be reached, so we can hand over your order and contact you about it.
            </li>
            <li>
              Menus depend on the location and the time you choose. Some items are only available at certain
              times of day. If an item in your cart is not available at the time you pick, we will tell you
              before you pay.
            </li>
            <li>
              You can order for as soon as possible or schedule an order ahead of time, within the times shown
              when you check out.
            </li>
            <li>
              Your order is confirmed once payment is accepted. You will receive a tracking link where you can
              follow its progress.
            </li>
          </ul>
        </Section>

        <Section id="prices" title="3. Prices, fees and payment">
          <ul className={list}>
            <li>
              Prices are shown in U.S. dollars on the menu and at checkout. Your checkout summary lists the
              subtotal, any discount, any delivery fee, a payment processing fee, and the total you will be
              charged. The total shown before you pay is the amount charged.
            </li>
            <li>
              A payment processing fee is added to cover card and online payment costs. It is shown as its own
              line before you pay.
            </li>
            <li>
              Payments are processed securely by our payment provider, Stripe. We do not see or store your full
              card details.
            </li>
            <li>
              Promo codes apply to the food subtotal only, not to delivery or processing fees, and are subject to
              the conditions shown with the code (for example dates, minimum order or usage limits). One promo
              code can be used per order.
            </li>
          </ul>
        </Section>

        <Section id="pickup" title="4. Pickup">
          <p>
            Please collect your order at the location you selected, at or after the pickup time you chose.
            Times are our best estimate; we will have your order ready as close to that time as we can. Please
            bring your order number or tracking link.
          </p>
        </Section>

        <Section id="delivery" title="5. Delivery">
          <ul className={list}>
            <li>
              Deliveries are carried out by an independent third-party courier service (currently Uber Direct),
              not by our staff. To arrange your delivery we share your name, phone number, delivery address,
              delivery instructions and the items in your order with that service.
            </li>
            <li>
              Delivery is only available to addresses the courier service can reach and, where we set one, for
              orders that meet the minimum order amount shown at checkout.
            </li>
            <li>
              The delivery fee is quoted for your address before you pay and you must accept it to continue.
              Quotes are only held for a short time. If a quote expires before you pay, we check the price again;
              if it changed, we show you the new price and you can accept it or choose pickup instead. We never
              charge a delivery fee you did not accept.
            </li>
            <li>
              Delivery times are estimates provided by the courier service and can change because of traffic,
              weather or courier availability.
            </li>
            <li>
              Please make sure someone is available to receive the order at the address given, and that your phone
              number and instructions (for example a gate code) are correct. If the courier cannot complete the
              delivery because of incorrect details or because nobody is available, we may not be able to offer a
              refund.
            </li>
            <li>
              The live tracking page and any contact with the courier are provided by the courier service and may
              be subject to its own terms.
            </li>
          </ul>
        </Section>

        <Section id="cancellations" title="6. Changes, cancellations and refunds">
          <ul className={list}>
            <li>
              To change or cancel an order, contact the location as soon as possible using the details below. Once
              we have started preparing your order we may not be able to change or cancel it.
            </li>
            <li>
              If we cancel your order (for example because an item is unavailable or a delivery cannot be
              completed for reasons on our side), we refund the full amount to your original payment method.
            </li>
            <li>
              If something is wrong with your order, please contact us the same day so we can make it right.
            </li>
            <li>
              Refunds are returned to the original payment method. How long they take to appear depends on your
              bank or card issuer.
            </li>
          </ul>
        </Section>

        <Section id="allergens" title="7. Allergens and dietary needs">
          <p>
            Our food is prepared in a kitchen that handles common allergens such as wheat, milk and eggs, and
            items may contain traces of others. We cannot guarantee that any item is free of allergens. Notes you add to an order are requests
            that we do our best to follow, not guarantees. If you have a severe allergy, please contact the
            location before ordering.
          </p>
        </Section>

        <Section id="accounts" title="8. Accounts and acceptable use">
          <ul className={list}>
            <li>
              If you sign in, you are responsible for activity on your account. Let us know if you think someone
              else has used it.
            </li>
            <li>
              Please do not misuse the website: for example, by placing orders you do not intend to collect or
              pay for, interfering with how the site works, or trying to access other people&apos;s orders or
              information. We may refuse or cancel orders that appear fraudulent or abusive.
            </li>
          </ul>
        </Section>

        <Section id="content" title="9. Our content">
          <p>
            The Rollecito name, logo, photos, menu descriptions and other content on this website belong to us
            or our licensors. You may not copy or use them for commercial purposes without our permission.
          </p>
        </Section>

        <Section id="liability" title="10. Availability and liability">
          <p>
            We work to keep the website available and accurate, but it may sometimes be unavailable, and menus,
            prices and hours can change. To the extent permitted by law, our responsibility to you for any
            order is limited to the amount you paid for that order. Nothing in these terms limits rights you
            have under consumer protection law that cannot be limited.
          </p>
        </Section>

        <Section id="privacy" title="11. Your information">
          <p>
            We use the details you give us to prepare, deliver and support your order.{' '}
            {showPrivacyLink ? (
              <>
                Our{' '}
                <Link href="/privacy" className={link}>
                  Privacy Policy
                </Link>{' '}
                explains how we handle personal information.
              </>
            ) : (
              <>For questions about your information, contact us using the details below.</>
            )}
          </p>
        </Section>

        <Section id="changes" title="12. Changes to these terms">
          <p>
            We may update these terms from time to time. Changes are posted on this page with a new &ldquo;Last
            updated&rdquo; date and apply to orders placed after that date.
          </p>
        </Section>

        <Section id="contact" title="13. Contact us">
          <ul className="space-y-1">
            <li>
              Email:{' '}
              <a href={`mailto:${legal.contactEmail}`} className={link}>
                {legal.contactEmail}
              </a>
            </li>
            <li>
              Phone:{' '}
              <a href={legal.contactPhoneHref} className={link}>
                {legal.contactPhoneDisplay}
              </a>
            </li>
          </ul>
          <p className="text-sm text-text-secondary">
            See also our{' '}
            <Link href="/accessibility" className={link}>
              Accessibility statement
            </Link>
            .
          </p>
        </Section>
      </div>
    </article>
  );
}
