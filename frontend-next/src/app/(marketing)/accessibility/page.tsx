import type { Metadata } from 'next';
import { legal } from '@/lib/config/legal';

export const metadata: Metadata = {
  title: 'Accessibility statement',
  description:
    'How The Rollecito approaches accessibility on its website and how to report a problem.',
  alternates: { canonical: '/accessibility' },
};

// The wording below is a technical draft reviewed against how the site
// actually works. Final wording is for the business (and its counsel, if it
// wishes) to approve — see docs/compliance/accessibility-audit.md.
//
// Deliberately NOT claimed here: ADA certification, full conformance, or any
// testing that has not happened (e.g. screen-reader testing, which is still
// pending on the checklist in the audit report).

function formatReviewed(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function AccessibilityPage() {
  const reviewed = formatReviewed(legal.accessibilityReviewedOn);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-text">
      <h1 className="text-3xl font-extrabold text-primary-dark">Accessibility statement</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Last reviewed: <time dateTime={legal.accessibilityReviewedOn}>{reviewed}</time>
      </p>

      <div className="mt-8 space-y-8 leading-relaxed">
        <section aria-labelledby="commitment">
          <h2 id="commitment" className="text-xl font-bold text-primary-dark">Our commitment</h2>
          <p className="mt-3">
            The Rollecito is committed to providing a website that is accessible to as many
            people as possible, including people who use a keyboard instead of a mouse,
            screen readers, screen magnification or browser zoom, and people with limited
            vision or colour vision differences.
          </p>
        </section>

        <section aria-labelledby="standard">
          <h2 id="standard" className="text-xl font-bold text-primary-dark">Standard we aim to follow</h2>
          <p className="mt-3">
            We aim to follow the{' '}
            <a
              href="https://www.w3.org/TR/WCAG22/"
              className="font-semibold text-primary-dark underline hover:text-primary"
            >
              Web Content Accessibility Guidelines (WCAG) 2.2
            </a>{' '}
            at Level AA. These guidelines explain how to make web content more accessible to
            people with disabilities. We are continuing to improve the site and do not
            claim that every page fully meets every guideline.
          </p>
        </section>

        <section aria-labelledby="measures">
          <h2 id="measures" className="text-xl font-bold text-primary-dark">What we have done</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              Reviewed the ordering journey, from choosing a location and pickup time through
              the menu, cart, checkout and order tracking, against WCAG 2.2 Level AA.
            </li>
            <li>
              Made menu items, pickup times, the cart and checkout usable with a keyboard
              alone, with a visible focus indicator.
            </li>
            <li>
              Made pop-up dialogs move focus into themselves, close with the Escape key, and
              return focus to where you were.
            </li>
            <li>
              Labelled form fields and buttons for screen readers, and announced changes such
              as items added to the cart, promo codes applied and order status updates.
            </li>
            <li>Added a &ldquo;Skip to main content&rdquo; link and a consistent page structure.</li>
            <li>
              Show order status in words (for example &ldquo;Preparing&rdquo; or
              &ldquo;Ready&rdquo;), not only by colour.
            </li>
            <li>Respect your device&rsquo;s &ldquo;reduce motion&rdquo; setting.</li>
            <li>Check pages with automated accessibility testing tools and by hand.</li>
          </ul>
        </section>

        <section aria-labelledby="limitations">
          <h2 id="limitations" className="text-xl font-bold text-primary-dark">Known limitations</h2>
          <p className="mt-3">We know about the following issues and are working on them:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              Some buttons and links in our brand colour do not yet have enough colour
              contrast for small text.
            </li>
            <li>
              The Spanish version of the site is partial: some ordering and checkout text is
              still shown in English.
            </li>
            <li>
              Card payments are entered in a secure form provided by our payment processor,
              Stripe. Its accessibility is managed by Stripe.
            </li>
            <li>
              Location pages include a map provided by Google. The address is also shown as
              text on the same page.
            </li>
          </ul>
        </section>

        <section aria-labelledby="feedback">
          <h2 id="feedback" className="text-xl font-bold text-primary-dark">
            Report a problem or get help ordering
          </h2>
          <p className="mt-3">
            If something on this website is hard to use, or you cannot place an order online
            because of an accessibility barrier, please tell us. Let us know the page, what
            you were trying to do, and the device, browser and any assistive technology you
            use, so we can look into it.
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              Email:{' '}
              <a
                href={`mailto:${legal.contactEmail}?subject=${encodeURIComponent('Accessibility feedback')}`}
                className="font-semibold text-primary-dark underline hover:text-primary"
              >
                {legal.contactEmail}
              </a>
            </li>
            <li>
              Phone:{' '}
              <a
                href={legal.contactPhoneHref}
                className="font-semibold text-primary-dark underline hover:text-primary"
              >
                {legal.contactPhoneDisplay}
              </a>
            </li>
          </ul>
        </section>

        <section aria-labelledby="assessment">
          <h2 id="assessment" className="text-xl font-bold text-primary-dark">How we assessed this site</h2>
          <p className="mt-3">
            This statement is based on a self-assessment by the team that builds the
            website, using automated testing tools and manual keyboard testing. It has not
            been verified by an independent auditor.
          </p>
        </section>
      </div>
    </article>
  );
}
