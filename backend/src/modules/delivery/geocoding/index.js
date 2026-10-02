const env = require('../../../config/env');
const census = require('./census.geocoder');

/**
 * Geocoder selection. To add Google / Mapbox later, implement the same
 * `geocode(address) -> { status, latitude?, longitude?, formatted? }` contract
 * and register it here.
 */
const disabled = { name: 'none', geocode: async () => ({ status: 'unavailable' }) };

const GEOCODERS = { census, none: disabled };

function getGeocoder() {
  return GEOCODERS[env.delivery.geocoder] || disabled;
}

module.exports = { getGeocoder };
