const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'restaurant_ordering',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    // Fee passthrough — added to total_amount at sp_order_calculate_total
    // time so the customer covers Stripe's percent + fixed fee.
    // Defaults to Stripe US standard (2.9% + $0.30). Override per region.
    feePercent: parseFloat(process.env.STRIPE_FEE_PERCENT) || 0.029,
    feeFixed: parseFloat(process.env.STRIPE_FEE_FIXED) || 0.30,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  s3: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
    publicUrlBase: process.env.S3_PUBLIC_URL_BASE, // optional: CloudFront or custom domain
    // S3-compatible endpoint override. Set in dev to a local MinIO server
    // (e.g. http://localhost:9000); leave unset to use real AWS S3.
    endpoint: process.env.S3_ENDPOINT || null,
  },
};

module.exports = env;
