const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: env.db.connectionLimit,
  waitForConnections: true,
  multipleStatements: false,
  namedPlaceholders: false,
  // Use the Node process's local TZ for DATETIME literal serialization. With
  // `TZ` set in docker-compose to match the restaurant's timezone, this keeps
  // mysql2, MySQL session, and JS `new Date()` all on the same clock — so
  // pickup_time validation (`NOW()`, `CURTIME()`) compares correctly.
  timezone: 'local',
  // MySQL DECIMAL columns return strings by default — convert to JS numbers
  typeCast: function (field, next) {
    if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') {
      const val = field.string();
      return val === null ? null : Number(val);
    }
    return next();
  },
});

// Pin the MySQL *session* timezone on every new connection so NOW(), CURTIME()
// and CURDATE() inside stored procedures (pickup-time validation, the daily
// per-location order counter) agree with the Node process. This matters for
// the managed-DB deploy path: AWS Lightsail DB / RDS run in UTC, and setting
// `TZ` on the backend container does NOT change the DB server's clock — only
// this SET does. Named zones need the tz tables loaded (present on RDS); if
// they're absent (a bare mysql image), the SET fails and the connection falls
// back to the server's SYSTEM tz — which our docker-compose sets via `TZ`, so
// it stays correct there too.
const SESSION_TZ = process.env.TZ || 'America/Los_Angeles';
let sessionTzWarned = false;
pool.on('connection', (connection) => {
  // The pool 'connection' event hands back a core (callback-style) connection,
  // so use the callback form. Capturing the error here is essential: an
  // unhandled error on a fresh pooled connection (e.g. named tz tables not
  // loaded on a bare mysql image) would otherwise destroy it. On failure we
  // fall back to the server's SYSTEM timezone — which our containers set via
  // `TZ`, so it stays correct.
  connection.query('SET time_zone = ?', [SESSION_TZ], (err) => {
    if (err && !sessionTzWarned) {
      sessionTzWarned = true; // warn once, not per pooled connection
      console.warn(
        `[DB] Could not set session time_zone to '${SESSION_TZ}' ` +
          `(${err.code}); falling back to the server's SYSTEM timezone. ` +
          `Load MySQL tz tables to pin a named zone with DST support.`
      );
    }
  });
});

/**
 * Call a stored procedure by name with positional parameters.
 * Returns the first result set (rows) — the standard shape for our SPs.
 *
 * This is the ONLY way the backend talks to the database.
 * No raw SQL, no query builder — just stored procedure calls.
 */
async function call(procedureName, params = []) {
  const placeholders = params.map(() => '?').join(', ');
  const sql = `CALL ${procedureName}(${placeholders})`;
  const [results] = await pool.execute(sql, params);
  // mysql2 returns [ [rows], [rows], ... , metadata ] for CALL statements
  // Our SPs return one or more result sets; return them all for multi-result SPs
  return results;
}

/**
 * Same as call() but returns multiple result sets (e.g. sp_order_get_items).
 * Returns an array of row-arrays.
 */
async function callMulti(procedureName, params = []) {
  const placeholders = params.map(() => '?').join(', ');
  const sql = `CALL ${procedureName}(${placeholders})`;
  const [results] = await pool.execute(sql, params);
  // Filter out the OkPacket metadata that mysql2 appends
  return Array.isArray(results[0]) ? results.filter(Array.isArray) : [results];
}

module.exports = { pool, call, callMulti };
