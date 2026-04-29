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

  console.log(`[Server] Running on port ${env.port} (${env.nodeEnv})`);
});
