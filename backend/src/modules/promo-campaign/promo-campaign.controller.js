const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const service = require('./promo-campaign.service');

// PUBLIC — the homepage modal asks for this on load.
const getActive = asyncHandler(async (req, res) => {
  const campaign = await service.getActive();
  res.json({ campaign });
});

const list = asyncHandler(async (req, res) => {
  res.json(await service.list());
});

const getById = asyncHandler(async (req, res) => {
  const campaign = await service.getById(req.params.id);
  if (!campaign) throw new AppError('Campaign not found.', 404);
  res.json(campaign);
});

/** Map the JSON body onto the service's input shape. */
function readBody(body) {
  return {
    name: body.name,
    promotionId: body.promotion_id,
    imageDesktopUrl: body.image_desktop_url,
    imageMobileUrl: body.image_mobile_url,
    imageAlt: body.image_alt,
    buttonText: body.button_text,
    buttonUrl: body.button_url,
    frequency: body.frequency,
    startsOn: body.starts_on,
    endsOn: body.ends_on,
    priority: body.priority,
    isActive: body.is_active,
    days: body.days,
  };
}

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.create(readBody(req.body)));
});

const update = asyncHandler(async (req, res) => {
  const campaign = await service.update(req.params.id, readBody(req.body));
  if (!campaign) throw new AppError('Campaign not found.', 404);
  res.json(campaign);
});

const remove = asyncHandler(async (req, res) => {
  const { deleted } = await service.remove(req.params.id);
  if (!deleted) throw new AppError('Campaign not found.', 404);
  res.status(204).send();
});

module.exports = { getActive, list, getById, create, update, remove };
