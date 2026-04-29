const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');

let s3Client = null;

function getS3Client() {
  if (!env.s3.bucket) return null;
  if (s3Client) return s3Client;

  s3Client = new S3Client({
    region: env.s3.region,
    followRegionRedirects: true,
    credentials: env.s3.accessKeyId && env.s3.secretAccessKey
      ? {
          accessKeyId: env.s3.accessKeyId,
          secretAccessKey: env.s3.secretAccessKey,
        }
      : undefined, // fall back to default credential chain (IAM role, ~/.aws/credentials)
  });
  return s3Client;
}

function publicUrl(key) {
  if (env.s3.publicUrlBase) {
    return `${env.s3.publicUrlBase.replace(/\/$/, '')}/${key}`;
  }
  return `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${key}`;
}

module.exports = { getS3Client, publicUrl };
