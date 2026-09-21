const asyncHandler = require('../../utils/asyncHandler');
const uploadService = require('./upload.service');
const menuService = require('../menu/menu.service');
const promoCampaignService = require('../promo-campaign/promo-campaign.service');

/**
 * Upload an image for a menu item. Stores on S3 and writes the
 * resulting URL back to the item row via sp_item_update.
 */
const uploadMenuItemImage = asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  const { url, key } = await uploadService.uploadMenuItemImage(itemId, req.body.image_base64);
  const updated = await menuService.updateItem(itemId, { imageUrl: url });
  res.json({ url, key, item: updated });
});

/**
 * Upload promotional artwork and write the URL onto the campaign.
 * The artwork IS the modal's content, so this is the main authoring step.
 */
const uploadPromoCampaignImage = asyncHandler(async (req, res) => {
  const campaignId = req.params.id;
  const variant = req.body.variant;
  const { url, key } = await uploadService.uploadPromoCampaignImage(
    campaignId, variant, req.body.image_base64,
  );
  const campaign = await promoCampaignService.setImage(campaignId, variant, url);
  res.json({ url, key, campaign });
});

module.exports = { uploadMenuItemImage, uploadPromoCampaignImage };
