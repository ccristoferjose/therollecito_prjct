const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');

const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/user/user.routes');
const orderRoutes = require('./modules/order/order.routes');
const paymentRoutes = require('./modules/payment/payment.routes');
const kitchenRoutes = require('./modules/kitchen/kitchen.routes');
const menuRoutes = require('./modules/menu/menu.routes');
const locationRoutes = require('./modules/location/location.routes');
const promotionRoutes = require('./modules/promotion/promotion.routes');
const uploadRoutes = require('./modules/upload/upload.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({ origin: env.cors.origin, credentials: true }));

// Stripe webhook needs raw body — mount BEFORE json parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

module.exports = app;
