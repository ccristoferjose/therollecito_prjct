const admin = require('firebase-admin');
const fs = require('fs');
const env = require('./env');

/**
 * Firebase Admin SDK initialization.
 *
 * Supports two methods (in priority order):
 *
 * 1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a JSON file
 *    → Firebase SDK auto-discovers it (no code needed)
 *
 * 2. FIREBASE_SERVICE_ACCOUNT env var with the JSON string inline
 *    → For production (AWS Secrets Manager, ECS task def, etc.)
 *
 * Both provide the service account credentials needed to verify
 * Firebase ID tokens sent by the frontend.
 */
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Option 2: inline JSON (production / AWS)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Option 1: file path (local dev) — SDK auto-discovers
    admin.initializeApp({
      projectId: env.firebase.projectId,
    });
  } else if (env.firebase.projectId) {
    // Fallback: project ID only (limited — token verification may fail)
    admin.initializeApp({
      projectId: env.firebase.projectId,
    });
  }
}

module.exports = admin;
