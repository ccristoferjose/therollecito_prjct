/**
 * Compliance pages and the contact channel they point to.
 *
 * The contact details are the ones the business already publishes in the site
 * footer; they are repeated here so the footer, /accessibility and /privacy
 * cannot drift apart.
 */
export const legal = {
  contactEmail: 'hello@therollecito.com',
  contactPhoneDisplay: '(323) 612-9202',
  contactPhoneHref: 'tel:+13236129202',

  /** Date the accessibility statement was last reviewed (ISO, local). */
  accessibilityReviewedOn: '2026-09-23',

  /**
   * The privacy policy is a DRAFT pending business and legal sign-off (see
   * docs/compliance/privacy-audit.md, section F). While false, /privacy returns
   * 404 in production builds and no page links to it, so an unapproved policy
   * with placeholder text is never shown to customers. It still renders in
   * development, marked as a draft, for review.
   */
  privacyPolicyPublished: false,
} as const;

/** Whether /privacy should be linked from customer-facing pages. */
export const showPrivacyLink = legal.privacyPolicyPublished;
