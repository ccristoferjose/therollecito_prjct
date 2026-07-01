const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');
const { initSocketIO } = require('./sockets');

const server = http.createServer(app);

// Initialize Socket.IO
initSocketIO(server);

server.listen(env.port, async () => {
  // Verify DB connection
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log(`[DB] Connected to MySQL (${env.db.host}:${env.db.port}/${env.db.database})`);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
  }

  // Loud warning for a silent failure mode: if Stripe is live but the webhook
  // secret is missing, constructEvent() rejects EVERY webhook, so paid orders
  // never flip to PAID via the webhook path — they'd rely entirely on the
  // browser's best-effort /payments/confirm call.
  if (env.stripe.secretKey && !env.stripe.webhookSecret) {
    console.warn(
      '[Stripe] STRIPE_WEBHOOK_SECRET is not set — webhook signature ' +
        'verification will fail and paid orders may not be marked PAID. ' +
        'Set it from the Stripe dashboard (or `stripe listen`) endpoint secret.'
    );
  }

  console.log(`[Server] Running on port ${env.port} (${env.nodeEnv})`);
});
