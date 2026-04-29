const { Router } = require('express');
const express = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const uploadController = require('./upload.controller');

const router = Router();

// Base64 payloads balloon by ~33% — a 5MB image becomes ~7MB of JSON.
// The global express.json() limit is 100kb, so we install a larger
// limit specifically for these upload routes.
const largeJson = express.json({ limit: '10mb' });

router.post(
  '/menu-items/:id/image',
  largeJson,
  requireAuth,
  requireRole('admin', 'manager'),
  [
    param('id').isInt({ gt: 0 }),
    body('image_base64').isString().notEmpty().withMessage('image_base64 is required.'),
    validateRequest,
  ],
  uploadController.uploadMenuItemImage
);

module.exports = router;
