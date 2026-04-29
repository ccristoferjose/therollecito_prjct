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
  // MySQL DECIMAL columns return strings by default — convert to JS numbers
  typeCast: function (field, next) {
    if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') {
      const val = field.string();
      return val === null ? null : Number(val);
    }
    return next();
  },
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
