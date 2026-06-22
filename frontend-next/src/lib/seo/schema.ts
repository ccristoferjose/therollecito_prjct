import type { Location } from '@/lib/types';

const ALL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** "09:00:00" → "09:00"; null/empty → null. */
function hhmm(t?: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

/** schema.org Bakery for a single location (rich results + local discovery). */
export function locationJsonLd(loc: Location, siteUrl: string) {
  const opens = hhmm(loc.open_time);
  const closes = hhmm(loc.close_time);
  return {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: `The Rollecito — ${loc.name}`,
    url: `${siteUrl}/locations/${loc.id}`,
    image: `${siteUrl}/icon_main.png`,
    servesCuisine: 'Bakery',
    priceRange: '$',
    ...(loc.phone ? { telephone: loc.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc.address,
      addressLocality: loc.city,
      addressRegion: loc.state,
      postalCode: loc.zip_code,
      addressCountry: 'US',
    },
    ...(opens && closes
      ? {
          openingHoursSpecification: [
            { '@type': 'OpeningHoursSpecification', dayOfWeek: ALL_DAYS, opens, closes },
          ],
        }
      : {}),
    potentialAction: {
      '@type': 'OrderAction',
      target: `${siteUrl}/order?location=${loc.id}`,
      deliveryMethod: 'http://purl.org/goodrelations/v1#PickUp',
    },
  };
}

/** Brand-level Bakery/Organization schema for the landing page. */
export function brandJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: 'The Rollecito',
    url: siteUrl,
    image: `${siteUrl}/icon_main.png`,
    description: 'Fresh-baked rolls, ordered online for pickup at a location near you.',
    servesCuisine: 'Bakery',
    priceRange: '$',
  };
}

/** ItemList of all locations for the /locations index page. */
export function locationListJsonLd(locations: Location[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: locations.map((loc, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/locations/${loc.id}`,
      name: loc.name,
    })),
  };
}
