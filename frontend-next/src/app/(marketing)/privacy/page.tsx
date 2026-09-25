import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { legal } from '@/lib/config/legal';

/**
 * DRAFT privacy policy, written from the data-collection audit in
 * docs/compliance/privacy-audit.md — every statement below describes what the
 * code actually does as of that audit. Anything the code cannot tell us
 * (legal entity, retention periods, which laws apply) is marked
 * [BUSINESS INPUT REQUIRED] and must be filled in and approved before
 * `legal.privacyPolicyPublished` is set to true.
 *
 * Until then this route 404s in production and nothing links to it.
 */

const published = legal.privacyPolicyPublished;

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What information The Rollecito collects when you order online, and how it is used.',
  alternates: { canonical: '/privacy' },
  robots: published ? undefined : { index: false, follow: false },
};

/** Visible marker for text the business or its counsel must supply. */
function Todo({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-warning/25 px-1 font-semibold text-warning-text">
      [BUSINESS INPUT REQUIRED: {children}]
    </mark>
  );
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

export default function PrivacyPage() {
  if (!published && process.env.NODE_ENV === 'production') notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 leading-relaxed text-text">
      {!published && (
        <p
          role="note"
          className="mb-8 rounded-lg border border-warning bg-warning/10 px-4 py-3 text-sm font-semibold text-warning-text"
        >
          DRAFT for business and legal review. Not published. Items marked
          [BUSINESS INPUT REQUIRED] must be completed before this page goes live.
        </p>
      )}

      <h1 className="text-3xl font-extrabold text-primary-dark">Privacy Policy</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Effective date: <Todo>effective date</Todo> · Last updated: <Todo>date</Todo>
      </p>

      <div className="mt-8 space-y-10">
        <Section id="who" title="Who we are">
          <p>
            This policy explains how The Rollecito (<Todo>legal business name and entity type</Todo>,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;) handles personal information when you use our website to
            order food for pickup. Our address is <Todo>registered business address</Todo>.
          </p>
        </Section>

        <Section id="collected" title="1. Information we collect">
          <p>When you place an order without an account, we collect:</p>
          <ul className={list}>
            <li>Your name (required, so we can hand your order to the right person).</li>
            <li>Your phone number, if you choose to give it.</li>
            <li>
              Any order notes you write, such as special requests. If you mention an allergy
              or dietary need, that note is stored with your order.
            </li>
            <li>
              Your order: the location, pickup time, items and options you chose, any promo
              code you used, prices, and the order&rsquo;s status as the kitchen works on it.
            </li>
          </ul>
          <p>If you sign in with Google, we also receive from Google:</p>
          <ul className={list}>
            <li>Your name and email address.</li>
            <li>A unique account identifier for your sign-in.</li>
            <li>Your phone number, only if it is included in your Google sign-in details.</li>
          </ul>
          <p>
            Your Google profile picture is shown to you while you are signed in. It is loaded
            directly from Google and is not stored by us.
          </p>
          <p>
            <strong>Payment information.</strong> Card details are entered into a secure form
            provided by our payment processor, Stripe, and go directly to Stripe. We do not
            receive or store your card number or security code. We keep a Stripe payment
            reference, the amount, the currency and whether the payment succeeded or was
            refunded.
          </p>
          <p>
            <strong>Technical information.</strong> Our ordering system does not record your IP
            address, device or browser details in its database. Our hosting and service
            providers may process this information as part of delivering the website (see
            section 5). <Todo>confirm whether web-server or reverse-proxy access logs record IP addresses, and for how long they are kept</Todo>
          </p>
        </Section>

        <Section id="how-collected" title="2. How we collect it">
          <ul className={list}>
            <li>Directly from you, when you fill in the checkout form.</li>
            <li>From Google, when you choose to sign in with Google.</li>
            <li>From Stripe, which tells us whether your payment succeeded.</li>
            <li>From your browser, which stores some information on your device (see section 7).</li>
          </ul>
        </Section>

        <Section id="why" title="3. Why we collect it">
          <ul className={list}>
            <li>To take, prepare and hand over your order at the pickup time you chose.</li>
            <li>
              To contact you about your order if needed. <Todo>confirm whether and how staff contact customers, e.g. by phone</Todo>
            </li>
            <li>To take payment and issue refunds.</li>
            <li>To apply promo codes and discounts.</li>
            <li>If you have an account: to show your order history and let you reorder.</li>
            <li>To keep records the business needs for accounting and legal purposes.</li>
          </ul>
        </Section>

        <Section id="use" title="4. How we use it">
          <p>
            Kitchen and store staff see the information needed to prepare and hand over your
            order: your name, phone number if given, notes, items and pickup time. Managers
            and administrators can also see customer accounts and their order history.
          </p>
          <p>
            We do not currently use your information to send marketing emails or text
            messages. <Todo>confirm, and update if marketing is planned</Todo>
          </p>
          <p>
            Anyone who has your order&rsquo;s tracking link can view that order&rsquo;s status and
            details, so please share it only with people you trust.
          </p>
        </Section>

        <Section id="providers" title="5. Service providers">
          <p>We use these providers to run the website. Each receives only what it needs:</p>
          <ul className={list}>
            <li>
              <strong>Stripe</strong> (payments): your card details, which you enter into
              Stripe&rsquo;s form, plus the order amount and our order number. Stripe also collects
              device and browser information to prevent fraud.
            </li>
            <li>
              <strong>Google Firebase Authentication</strong> (sign-in): used only if you sign in
              with Google.
            </li>
            <li>
              <strong>Amazon Web Services</strong> (hosting): runs our website and ordering
              system and stores our database, menu images and promotional images.
            </li>
            <li>
              <strong>Google Maps</strong>: our location pages include an embedded Google map,
              which loads from Google when you open the page. Links to Google Maps, Apple
              Maps or Waze open those services only when you choose them.
            </li>
            <li>
              <strong>Google Fonts</strong>: <Todo>the current site loads its font from Google&rsquo;s servers, which receive your IP address; the new site hosts the font itself. Keep or remove this line depending on which site is live when the policy is published</Todo>
            </li>
          </ul>
          <p>
            We do not use advertising or analytics trackers on the website.{' '}
            <Todo>confirm that no personal information is sold or shared for cross-context behavioral advertising</Todo>
          </p>
        </Section>

        <Section id="payments" title="6. Payment processing">
          <p>
            Payments are processed by Stripe. Card details go directly from your browser to
            Stripe and are not stored on our servers. Stripe&rsquo;s own privacy policy applies
            to the information it collects:{' '}
            <a href="https://stripe.com/privacy" className="font-semibold text-primary-dark underline">
              stripe.com/privacy
            </a>
            .
          </p>
        </Section>

        <Section id="storage" title="7. Cookies and similar technologies">
          <p>
            Our website does not set advertising or analytics cookies. It stores the
            following in your browser so ordering works:
          </p>
          <ul className={list}>
            <li>Your cart and chosen location, until you place the order or clear your browser data.</li>
            <li>Your chosen pickup time, until that time has passed.</li>
            <li>
              Tracking codes for up to your last 10 guest orders, so you can find them again
              on this device.
            </li>
            <li>Your language preference.</li>
            <li>A note of which promotions you have already seen, so they are not shown again.</li>
            <li>If you sign in with Google: your sign-in session, until you sign out.</li>
          </ul>
          <p>
            Stripe sets its own cookies on the checkout page to prevent fraud, and the
            embedded Google map may set Google cookies. <Todo>legal review: whether a consent mechanism is required for the Google Maps embed in the jurisdictions you serve</Todo>
          </p>
          <p>You can clear all of this at any time from your browser settings.</p>
        </Section>

        <Section id="retention" title="8. How long we keep information">
          <p>
            <Todo>
              retention periods for: completed orders and payment records; unpaid or abandoned
              orders; customer accounts; server logs; backups. The system currently keeps all of
              these indefinitely; recommended periods are in the audit report
            </Todo>
          </p>
        </Section>

        <Section id="security" title="9. How we protect information">
          <p>
            Card payments are handled by Stripe, so card details never reach our servers.
            Staff access to the ordering system requires an account and is limited by role.
          </p>
          <p>
            <Todo>
              do not publish this section until the security fixes marked Critical in the privacy
              audit are deployed; then confirm encryption in transit (HTTPS) and at rest
            </Todo>
          </p>
        </Section>

        <Section id="choices" title="10. Your choices and requests">
          <ul className={list}>
            <li>You can order as a guest, without an account.</li>
            <li>Your phone number and order notes are optional.</li>
            <li>You can sign out at any time from your profile page.</li>
            <li>
              To ask what information we hold about you, or to ask us to correct or delete
              it, contact us using the details below. We will need to verify your request.
            </li>
          </ul>
          <p>
            <Todo>legal review: which privacy laws apply (for example the California CCPA/CPRA) and which rights must be listed here, with response times</Todo>
          </p>
          <p>
            <Todo>confirm the service is not directed to children under 13 and state the policy on children&rsquo;s information</Todo>
          </p>
        </Section>

        <Section id="changes" title="11. Changes to this policy">
          <p>
            We will post any changes on this page and update the &ldquo;Last updated&rdquo; date
            above. <Todo>confirm how customers will be told about significant changes</Todo>
          </p>
        </Section>

        <Section id="contact" title="12. Contact us">
          <p>Questions or requests about your information:</p>
          <ul className="space-y-1">
            <li>
              Email:{' '}
              <a href={`mailto:${legal.contactEmail}`} className="font-semibold text-primary-dark underline">
                {legal.contactEmail}
              </a>{' '}
              <Todo>confirm this is the right inbox for privacy requests</Todo>
            </li>
            <li>
              Phone:{' '}
              <a href={legal.contactPhoneHref} className="font-semibold text-primary-dark underline">
                {legal.contactPhoneDisplay}
              </a>
            </li>
          </ul>
        </Section>
      </div>
    </article>
  );
}
