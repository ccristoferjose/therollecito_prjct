/**
 * Customer delivery pricing.
 *
 * The provider's fee is what Rollecito PAYS; the customer delivery fee is what
 * the customer is CHARGED. They are stored separately (delivery.provider_fee vs
 * delivery.customer_delivery_fee) and this is the only place that derives one
 * from the other.
 *
 * Rule (admin-configurable, see delivery.settings.js): the customer pays
 * `customerFeePercent` of the provider fee and the restaurant covers the rest.
 *   100 -> customer pays everything      50 -> 50 / 50
 *    40 -> customer 40 %, restaurant 60 %  0 -> free delivery
 *
 * All amounts are integer cents to avoid float drift. The customer's share is
 * rounded to the nearest cent; the restaurant covers exactly the remainder, so
 * the two always add up to the provider fee.
 *
 * @param {object} input
 * @param {number} input.providerFeeCents
 * @param {{ customerFeePercent: number }} [input.settings]
 * @returns {{ providerFeeCents: number, customerFeeCents: number, subsidyCents: number }}
 */
function priceDelivery({ providerFeeCents, settings }) {
  const provider = Math.max(0, Math.round(providerFeeCents));
  const percent = Math.min(100, Math.max(0, Number(settings?.customerFeePercent ?? 100)));
  const customerFeeCents = Math.round((provider * percent) / 100);
  return {
    providerFeeCents: provider,
    customerFeeCents,
    subsidyCents: provider - customerFeeCents,
  };
}

module.exports = { priceDelivery };
