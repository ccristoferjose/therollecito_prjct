import { S3Client } from "@aws-sdk/client-s3";

const bucketName = process.env.S3_BUCKET;
const isLocalDev = !!process.env.S3_ENDPOINT;

export let isUploadEnabled = false;
export let s3Client = null;

if (bucketName) {
  isUploadEnabled = true;

  const clientConfig = {
    region: process.env.AWS_REGION || "us-east-1",
  };

  // Apply local development overrides ONLY if S3_ENDPOINT is present
  if (isLocalDev) {
    clientConfig.endpoint = process.env.S3_ENDPOINT;

    // Explicit local dummy credentials
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };

    // Path-style addressing enabled only when required by the local emulator
    if (process.env.FORCE_PATH_STYLE === "true") {
      clientConfig.forcePathStyle = true;
    }
  }

  // If NOT isLocalDev, the AWS SDK automatically falls back to the
  // default credential chain (IAM roles, ~/.aws/credentials, etc.)

  s3Client = new S3Client(clientConfig);
} else {
  console.warn("[S3] S3_BUCKET is unset. File uploads are disabled.");
}
