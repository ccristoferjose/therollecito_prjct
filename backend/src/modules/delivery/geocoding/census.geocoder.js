/**
 * US Census Bureau geocoder — free, keyless, US-only. Good enough to confirm an
 * address exists and to obtain coordinates for the courier provider.
 *
 * Returns one of:
 *   { status: 'matched', latitude, longitude, formatted }
 *   { status: 'no_match' }        the address does not exist -> INVALID_ADDRESS
 *   { status: 'unavailable' }     geocoder down / slow -> continue without coords
 *
 * A geocoder outage must never block delivery: providers geocode on their own,
 * so the caller simply proceeds without coordinates.
 */

const ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/locations/address';
const TIMEOUT_MS = 5000;

async function geocode(address) {
  const params = new URLSearchParams({
    street: address.streetAddress,
    city: address.city,
    state: address.state,
    zip: address.zipCode,
    benchmark: 'Public_AR_Current',
    format: 'json',
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { status: 'unavailable' };
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return { status: 'no_match' };

    const latitude = Number(match.coordinates?.y);
    const longitude = Number(match.coordinates?.x);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { status: 'unavailable' };

    return {
      status: 'matched',
      latitude: Math.round(latitude * 1e6) / 1e6,
      longitude: Math.round(longitude * 1e6) / 1e6,
      formatted: match.matchedAddress || null,
    };
  } catch (err) {
    console.warn('[Delivery] Census geocoder unavailable:', err.name === 'TimeoutError' ? 'timeout' : err.message);
    return { status: 'unavailable' };
  }
}

module.exports = { name: 'census', geocode };
