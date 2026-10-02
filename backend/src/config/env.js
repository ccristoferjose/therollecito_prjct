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
    // 12h covers a full kitchen shift without the token expiring mid-service
    // (which would silently stop the dashboard from loading new orders).
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
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

  // Delivery fulfillment. Provider-neutral settings; provider credentials live
  // in their own block below and are NEVER sent to the browser.
  delivery: {
    // Kill switch. Delivery is also unavailable whenever the provider is not
    // configured, so an environment without credentials simply offers pickup.
    enabled: process.env.DELIVERY_ENABLED !== 'false',
    provider: process.env.DELIVERY_PROVIDER || 'uber_direct',
    // ASAP orders: courier pickup is requested for now + prep time. The service
    // period's prep_time_minutes wins when it is set (> 0); this is the fallback.
    defaultPrepMinutes: parseInt(process.env.DELIVERY_DEFAULT_PREP_MINUTES, 10) || 20,
    // Treat a quote as expired this many seconds early, so a quote cannot lapse
    // between our check and the customer's payment completing.
    quoteExpiryBufferSeconds: parseInt(process.env.DELIVERY_QUOTE_EXPIRY_BUFFER_SECONDS, 10) || 60,
    // Optional straight-line radius from the location. Unset = the provider decides.
    maxRadiusMiles: parseFloat(process.env.DELIVERY_MAX_RADIUS_MILES) || null,
    // 'census' (US Census geocoder — free, no key) or 'none'.
    geocoder: process.env.DELIVERY_GEOCODER || 'census',
    // Used when a location has no phone of its own; couriers must be able to call the store.
    pickupPhoneFallback: process.env.DELIVERY_PICKUP_PHONE || null,
    externalStoreIdPrefix: process.env.DELIVERY_EXTERNAL_STORE_PREFIX || 'rollecito',
  },

  uber: {
    clientId: process.env.UBER_CLIENT_ID,
    clientSecret: process.env.UBER_CLIENT_SECRET,
    customerId: process.env.UBER_CUSTOMER_ID,
    webhookSigningKey: process.env.UBER_WEBHOOK_SIGNING_KEY,
    authUrl: process.env.UBER_AUTH_URL || 'https://auth.uber.com/oauth/v2/token',
    apiBaseUrl: process.env.UBER_API_BASE_URL || 'https://api.uber.com',
    scope: process.env.UBER_SCOPE || 'eats.deliveries',
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

if (env.nodeEnv === 'production') {
  if (!env.s3.bucket) {
    throw new Error('Invalid production S3 config: S3_BUCKET is required.');
  }

  if (env.s3.endpoint) {
    throw new Error('Invalid production S3 config: S3_ENDPOINT must be unset. Production must use AWS S3.');
  }

  if (env.s3.publicUrlBase && /(^|\/\/)(localhost|127\.0\.0\.1|minio)(:|\/|$)/i.test(env.s3.publicUrlBase)) {
    throw new Error('Invalid production S3 config: S3_PUBLIC_URL_BASE points to a local/MinIO host.');
  }

  if (env.s3.bucket === 'the-rollecito-dev' || env.s3.bucket === 'menu-images') {
    throw new Error('Invalid production S3 config: S3_BUCKET is a known local development bucket.');
  }
}

module.exports = env;
