const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

/**
 * Staff login: verify credentials against DB, return JWT.
 * Only admin and manager roles can use staff login.
 */
async function staffLogin(email, password) {
  // Get user by email via SP (we need a read procedure)
  // For staff login we use sp_user_get_by_email which returns the password hash
  const result = await db.call('sp_user_get_by_email', [email]);
  const rows = Array.isArray(result[0]) ? result[0] : result;

  if (!rows.length) {
    throw new AppError('Invalid email or password.', 401);
  }

  const user = rows[0];

  if (user.role_name === 'client') {
    throw new AppError('Staff login only. Clients must use Firebase.', 403);
  }

  if (user.is_active === 0) {
    throw new AppError('Account is disabled. Contact an administrator.', 403);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password.', 401);
  }

  const token = jwt.sign(
    {
      user_id: user.id,
      role: user.role_name,
      location_id: user.location_id || null,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role_name,
      location_id: user.location_id || null,
    },
  };
}

/**
 * Firebase client auth: auto-create user if not exists, return user data.
 * Called by requireFirebaseAuth middleware — this is a helper if needed directly.
 */
async function firebaseAuth(firebaseUid, email, firstName, lastName, phone) {
  const result = await db.call('sp_user_create_if_not_exists', [
    firebaseUid,
    email,
    firstName,
    lastName,
    phone,
  ]);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows[0];
}

module.exports = { staffLogin, firebaseAuth };
