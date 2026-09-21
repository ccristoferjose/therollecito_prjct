const db = require('../../config/db');

/**
 * Promotional campaigns — the artwork and schedule behind the homepage modal.
 * The discount itself lives in the `promotion` module; a campaign links to one
 * optionally (see migration 007).
 */

/** DAYOFWEEK() numbering: 1 = Sunday ... 7 = Saturday. */
const DAY_NAMES = ['', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Normalise a weekday selection to the CSV the procedures expect.
 * `undefined` means "leave the schedule alone"; an empty array means
 * "every day" (no day rows), matching the table's documented semantics.
 */
function daysToCsv(days) {
  if (days === undefined || days === null) return null;
  const valid = [...new Set(days.map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    .sort((a, b) => a - b);
  return valid.join(',');
}

/** Shape a campaign row + its weekday rows into one API object. */
function shape(campaign, dayRows) {
  if (!campaign) return null;
  const days = dayRows
    .filter((d) => d.promo_campaign_id === campaign.id)
    .map((d) => d.day_of_week);
  return {
    ...campaign,
    days,
    day_names: days.map((d) => DAY_NAMES[d]),
    // No day rows means the campaign runs every day.
    runs_every_day: days.length === 0,
  };
}

/** PUBLIC — the single campaign to show right now, or null. */
async function getActive() {
  const result = await db.call('sp_promo_campaign_active', []);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0] || null;
}

async function list() {
  const [campaigns = [], dayRows = []] = await db.callMulti('sp_promo_campaign_list', []);
  return campaigns.map((c) => shape(c, dayRows));
}

async function getById(id) {
  const [campaigns = [], dayRows = []] = await db.callMulti('sp_promo_campaign_get', [id]);
  return shape(campaigns[0], dayRows);
}

async function create(input) {
  const [campaigns = [], dayRows = []] = await db.callMulti('sp_promo_campaign_create', [
    input.name,
    input.promotionId ?? null,
    input.imageDesktopUrl ?? null,
    input.imageMobileUrl ?? null,
    input.imageAlt ?? null,
    input.buttonText ?? null,
    input.buttonUrl ?? null,
    input.frequency ?? 'once_per_day',
    input.startsOn,
    input.endsOn ?? null,
    input.priority ?? 0,
    input.isActive === undefined ? 1 : (input.isActive ? 1 : 0),
    daysToCsv(input.days),
  ]);
  return shape(campaigns[0], dayRows);
}

/**
 * Partial update. A field left `undefined` keeps its stored value; passing an
 * empty string clears a nullable text column. `days` behaves the same way:
 * omit it and the weekday schedule is untouched, which is what a bare
 * status toggle from the admin list needs.
 */
async function update(id, input) {
  const clear = (v) => (v === undefined ? null : v === null ? '' : v);
  const daysCsv = daysToCsv(input.days);

  const [campaigns = [], dayRows = []] = await db.callMulti('sp_promo_campaign_update', [
    id,
    input.name ?? null,
    input.promotionId ?? null,
    input.promotionId === null ? 1 : 0,
    clear(input.imageDesktopUrl),
    clear(input.imageMobileUrl),
    clear(input.imageAlt),
    clear(input.buttonText),
    clear(input.buttonUrl),
    input.frequency ?? null,
    input.startsOn ?? null,
    input.endsOn ?? null,
    input.endsOn === null ? 1 : 0,
    input.priority ?? null,
    input.isActive === undefined ? null : (input.isActive ? 1 : 0),
    daysCsv,
    daysCsv === null ? 0 : 1,
  ]);
  return shape(campaigns[0], dayRows);
}

async function remove(id) {
  const result = await db.call('sp_promo_campaign_delete', [id]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return { deleted: rows[0]?.deleted ?? 0 };
}

async function setImage(id, variant, url) {
  const [campaigns = [], dayRows = []] = await db.callMulti('sp_promo_campaign_set_image', [
    id, variant, url,
  ]);
  return shape(campaigns[0], dayRows);
}

module.exports = { getActive, list, getById, create, update, remove, setImage, DAY_NAMES };
