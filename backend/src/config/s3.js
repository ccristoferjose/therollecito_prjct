const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');

let s3Client = null;

function getS3Client() {
  if (!env.s3.bucket) return null;
  if (s3Client) return s3Client;

  const config = {
    region: env.s3.region,
    followRegionRedirects: true,
    credentials: env.s3.accessKeyId && env.s3.secretAccessKey
      ? {
          accessKeyId: env.s3.accessKeyId,
          secretAccessKey: env.s3.secretAccessKey,
        }
      : undefined, // fall back to default credential chain (IAM role, ~/.aws/credentials)
  };

  // S3-compatible endpoint (e.g. local MinIO in dev). MinIO serves buckets at
  // a path (host:9000/bucket/key), not as virtual-host subdomains, so we must
  // force path-style addressing and disable AWS region-redirect handling.
  if (env.s3.endpoint) {
    config.endpoint = env.s3.endpoint;
    config.forcePathStyle = true;
    config.followRegionRedirects = false;
  }

  s3Client = new S3Client(config);
  return s3Client;
}

function publicUrl(key) {
  if (env.s3.publicUrlBase) {
    return `${env.s3.publicUrlBase.replace(/\/$/, '')}/${key}`;
  }
  return `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${key}`;
}

module.exports = { getS3Client, publicUrl };
