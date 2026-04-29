const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client, publicUrl } = require('../../config/s3');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_BYTES = 5 * 1024 * 1024; // 5MB after decoding

/**
 * Parse a data URL of the form "data:image/jpeg;base64,<payload>".
 * Throws AppError on any malformed or disallowed input.
 */
function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw new AppError('image_base64 must be a string.', 400);
  }
  const match = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (!match) {
    throw new AppError('image_base64 must be a data URL (data:<mime>;base64,<payload>).', 400);
  }
  const mime = match[1].toLowerCase();
  const ext = ALLOWED_MIME[mime];
  if (!ext) {
    throw new AppError(`Unsupported image type: ${mime}. Allowed: jpeg, png, webp.`, 400);
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_BYTES) {
    throw new AppError(`Image exceeds ${MAX_BYTES / (1024 * 1024)}MB limit.`, 413);
  }
  return { buffer, mime, ext };
}

/**
 * Upload a menu item photo to S3 under a clear, per-item prefix:
 *
 *   menu/items/{itemId}/{timestamp}-{random}.{ext}
 *
 * The timestamp cache-busts when an item's image is replaced, and the
 * per-item prefix lets us prune an item's entire folder on delete.
 */
async function uploadMenuItemImage(itemId, imageBase64) {
  const client = getS3Client();
  if (!client) {
    throw new AppError('S3 is not configured on the server.', 500);
  }

  const { buffer, mime, ext } = parseDataUrl(imageBase64);
  const random = crypto.randomBytes(6).toString('hex');
  const key = `menu/items/${itemId}/${Date.now()}-${random}.${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: env.s3.bucket,
    Key: key,
    Body: buffer,
    ContentType: mime,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { key, url: publicUrl(key), bytes: buffer.length, mime };
}

module.exports = { uploadMenuItemImage };
