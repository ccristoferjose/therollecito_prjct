const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validateRequest = require('../../middleware/validateRequest');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const menuController = require('./menu.controller');

const router = Router();

// Public: get full menu for a location (filtered by item_location)
router.get(
  '/location/:locationId',
  [param('locationId').isInt({ gt: 0 }), validateRequest],
  menuController.getFullMenu
);

// Public: menu for a location AT A PICKUP TIME (service-period aware).
// Omitting pickupTime resolves against "now", matching the legacy behaviour of
// the route above. Returns 400 when nothing is bookable at that time.
router.get(
  '/location/:locationId/pickup',
  [
    param('locationId').isInt({ gt: 0 }),
    query('pickupTime').optional({ nullable: true, checkFalsy: true }).isISO8601()
      .withMessage('pickupTime must be an ISO 8601 datetime.'),
    validateRequest,
  ],
  menuController.getFullMenuForPickup
);

// Admin: get ALL menu items (for management — includes item_location data)
router.get(
  '/all',
  requireAuth,
  requireRole('admin', 'manager'),
  menuController.getAllMenu
);

// Admin: create menu
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'manager'),
  [body('name').notEmpty().withMessage('Menu name required.'), validateRequest],
  menuController.createMenu
);

// Admin: create category
router.post(
  '/categories',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    body('menuId').isInt({ gt: 0 }),
    body('name').notEmpty().withMessage('Category name required.'),
    validateRequest,
  ],
  menuController.createCategory
);

// Admin: update category
router.patch(
  '/categories/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  menuController.updateCategory
);

// Admin: delete category
router.delete(
  '/categories/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  menuController.deleteCategory
);

// Admin: create item
router.post(
  '/items',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    body('categoryId').isInt({ gt: 0 }),
    body('name').notEmpty(),
    body('price').isFloat({ gt: 0 }),
    validateRequest,
  ],
  menuController.createItem
);

// Admin: update item
router.patch(
  '/items/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  menuController.updateItem
);

// Admin: delete item
router.delete(
  '/items/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  menuController.deleteItem
);

// Admin: sync item locations (set which locations an item is available at)
router.put(
  '/items/:id/locations',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    param('id').isInt({ gt: 0 }),
    body('location_ids').isArray(),
    validateRequest,
  ],
  menuController.syncItemLocations
);

// Admin: create item option
router.post(
  '/items/options',
  requireAuth,
  requireRole('admin', 'manager'),
  [body('itemId').isInt({ gt: 0 }), body('name').notEmpty(), validateRequest],
  menuController.createItemOption
);

// Admin: update item option (rename / change required / max_choices)
router.patch(
  '/items/options/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  menuController.updateItemOption
);

// Admin: delete item option (cascade-removes its values; past order rows
// fall through ON DELETE SET NULL with names preserved via snapshot)
router.delete(
  '/items/options/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  menuController.deleteItemOption
);

// Admin: clone an existing option group (+ its values) onto another item as a
// new independent copy. Lets admins reuse a topping group without retyping it;
// the copy is editable without affecting the source.
router.post(
  '/items/options/clone',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    body('sourceOptionId').isInt({ gt: 0 }),
    body('targetItemId').isInt({ gt: 0 }),
    validateRequest,
  ],
  menuController.cloneItemOption
);

// Admin: create item option value
router.post(
  '/items/options/values',
  requireAuth,
  requireRole('admin', 'manager'),
  [body('itemOptionId').isInt({ gt: 0 }), body('name').notEmpty(), validateRequest],
  menuController.createItemOptionValue
);

// Admin: update item option value (rename / change price modifier)
router.patch(
  '/items/options/values/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  menuController.updateItemOptionValue
);

// Admin: delete a single option value
router.delete(
  '/items/options/values/:id',
  requireAuth,
  requireRole('admin', 'manager'),
  [param('id').isInt({ gt: 0 }), validateRequest],
  menuController.deleteItemOptionValue
);

// --- Menu <-> category membership (migration 006) ---------------------------
// Which categories each menu contains. A category on several menus lets one
// product be sold in several service periods without duplicating the item.
router.get(
  '/categories/menus',
  requireAuth,
  requireRole('admin', 'manager'),
  menuController.listMenuCategories
);

// Attach (or re-sort) a category on a menu.
router.put(
  '/:menuId/categories/:categoryId',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    param('menuId').isInt({ gt: 0 }),
    param('categoryId').isInt({ gt: 0 }),
    body('sort_order').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  menuController.attachCategoryToMenu
);

// Remove a category from a menu. Rejected if it is the category's last menu.
router.delete(
  '/:menuId/categories/:categoryId',
  requireAuth,
  requireRole('admin', 'manager'),
  [
    param('menuId').isInt({ gt: 0 }),
    param('categoryId').isInt({ gt: 0 }),
    validateRequest,
  ],
  menuController.detachCategoryFromMenu
);

module.exports = router;
