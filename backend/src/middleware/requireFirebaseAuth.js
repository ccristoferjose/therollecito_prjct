const firebaseAdmin = require('../config/firebase');
const AppError = require('../utils/AppError');
const db = require('../config/db');

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Auto-creates the user via sp_user_create_if_not_exists if they don't exist.
 * Attaches the DB user row to req.user.
 */
async function requireFirebaseAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Firebase authentication required.', 401));
  }

  const idToken = header.split(' ')[1];

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);

    const firebaseUid = decoded.uid;
    const email = decoded.email || '';
    const firstName = decoded.name?.split(' ')[0] || 'Guest';
    const lastName = decoded.name?.split(' ').slice(1).join(' ') || '';

    // Auto-create if not exists — returns the user row either way
    const result = await db.call('sp_user_create_if_not_exists', [
      firebaseUid,
      email,
      firstName,
      lastName,
      decoded.phone_number || null,
    ]);

    const rows = Array.isArray(result[0]) ? result[0] : result;
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.isOperational) return next(err);
    next(new AppError('Invalid Firebase token.', 401));
  }
}

module.exports = requireFirebaseAuth;
