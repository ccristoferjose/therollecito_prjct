const env = require('../../../config/env');
const uberDirect = require('./uber-direct.provider');

/**
 * Delivery provider registry. Orders and checkout only ever talk to
 * delivery.service, which talks to whichever provider is configured here — so a
 * second provider (DoorDash Drive, in-house couriers, ...) is a new file that
 * implements the same contract (see uber-direct.provider.js) plus one line below.
 */
const PROVIDERS = {
  [uberDirect.name]: uberDirect,
};

function getProvider(name = env.delivery.provider) {
  return PROVIDERS[name] || null;
}

module.exports = { getProvider };
