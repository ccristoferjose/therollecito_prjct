const { Router } = require('express');
const requireAuth = require('../../middleware/requireAuth');
const requireRole = require('../../middleware/requireRole');
const dashboardController = require('./dashboard.controller');

const router = Router();

// All dashboard endpoints are admin/manager only.
router.get('/overview', requireAuth, requireRole('admin', 'manager'), dashboardController.getOverview);
router.get('/revenue', requireAuth, requireRole('admin', 'manager'), dashboardController.getDailyRevenue);

module.exports = router;
