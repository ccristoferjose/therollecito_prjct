const { Router } = require('express');
const { body, param } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./promo-campaign.controller');

const router = Router();

const FREQUENCIES = ['once_per_day', 'once_per_session', 'always'];

// Shared field rules. `optional` so the same list serves create and PATCH-style
// updates; create additionally requires name + starts_on below.
const fieldRules = [
  body('name').optional().isString().trim().isLength({ min: 1, max: 150 })
    .withMessage('name must be 1-150 characters.'),
  body('promotion_id').optional({ nullable: true }).isInt({ gt: 0 })
    .withMessage('promotion_id must be a positive integer or null.'),
  body('image_desktop_url').optional({ nullable: true }).isString().isLength({ max: 512 }),
  body('image_mobile_url').optional({ nullable: true }).isString().isLength({ max: 512 }),
  body('image_alt').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('button_text').optional({ nullable: true }).isString().isLength({ max: 80 }),
  // Internal paths only — an admin-set absolute URL would turn the modal's CTA
  // into an open redirect off the site.
  body('button_url').optional({ nullable: true }).isString().isLength({ max: 255 })
    .matches(/^\/[^/\\]/).withMessage('button_url must be an internal path starting with "/".'),
  body('frequency').optional().isIn(FREQUENCIES)
    .withMessage(`frequency must be one of: ${FREQUENCIES.join(', ')}.`),
  body('starts_on').optional().isISO8601().withMessage('starts_on must be YYYY-MM-DD.'),
  body('ends_on').optional({ nullable: true }).isISO8601().withMessage('ends_on must be YYYY-MM-DD.'),
  body('priority').optional().isInt({ min: 0, max: 100000 }),
  body('is_active').optional().isBoolean(),
  body('days').optional().isArray().withMessage('days must be an array of 1-7 (1=Sunday).'),
  body('days.*').optional().isInt({ min: 1, max: 7 })
    .withMessage('each day must be 1 (Sunday) through 7 (Saturday).'),
];

// PUBLIC — no auth. Returns at most one campaign, or { campaign: null }.
router.get('/active', controller.getActive);

router.get('/', requireAuth, requireRole('admin', 'manager'), controller.list);

router.get(
  '/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  controller.getById
);

router.post(
  '/',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    body('name').isString().trim().isLength({ min: 1, max: 150 })
      .withMessage('A campaign name is required.'),
    body('starts_on').isISO8601().withMessage('A start date is required (YYYY-MM-DD).'),
    ...fieldRules,
    validateRequest,
  ],
  controller.create
);

router.put(
  '/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), ...fieldRules, validateRequest],
  controller.update
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  controller.remove
);

module.exports = router;
