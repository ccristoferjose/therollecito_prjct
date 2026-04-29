const asyncHandler = require('../../utils/asyncHandler');
const uploadService = require('./upload.service');
const menuService = require('../menu/menu.service');

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

module.exports = { uploadMenuItemImage };
