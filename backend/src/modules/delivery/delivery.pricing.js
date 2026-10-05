/**
 * Customer delivery pricing.
 *
 * The provider's fee is what Rollecito PAYS; the customer delivery fee is what
 * the customer is CHARGED. They are stored separately (delivery.provider_fee vs
 * delivery.customer_delivery_fee) and this is the only place that derives one
 * from the other.
 *
 * Two admin-configurable rules (see delivery.settings.js):
 *
 *   PERCENT  the customer pays `customerFeePercent` of the provider fee.
 *              100 -> customer pays everything      50 -> 50 / 50
 *               40 -> customer 40 %, restaurant 60 %  0 -> free delivery
 *
 *   FLAT     the restaurant covers up to `restaurantFlatAmount` dollars and the
 *            customer pays the rest, never below $0.
 *              fee $10.99, flat $3.00 -> customer $7.99, restaurant $3.00
 *              fee  $2.50, flat $3.00 -> customer $0.00, restaurant $2.50
 *
 * All amounts are integer cents to avoid float drift. Customer + restaurant
 * always add up to exactly the provider fee.
 *
 * @param {object} input
 * @param {number} input.providerFeeCents
 * @param {{ feeSplitMode?: 'PERCENT' | 'FLAT', customerFeePercent?: number, restaurantFlatAmount?: number }} [input.settings]
 * @returns {{ providerFeeCents: number, customerFeeCents: number, subsidyCents: number }}
 */
function priceDelivery({ providerFeeCents, settings }) {
  const provider = Math.max(0, Math.round(providerFeeCents));

  let subsidyCents;
  if (settings?.feeSplitMode === 'FLAT') {
    const flatCents = Math.max(0, Math.round(Number(settings.restaurantFlatAmount ?? 0) * 100));
    subsidyCents = Math.min(provider, flatCents);
  } else {
    const percent = Math.min(100, Math.max(0, Number(settings?.customerFeePercent ?? 100)));
    subsidyCents = provider - Math.round((provider * percent) / 100);
  }

  return {
    providerFeeCents: provider,
    customerFeeCents: provider - subsidyCents,
    subsidyCents,
  };
}

module.exports = { priceDelivery };
