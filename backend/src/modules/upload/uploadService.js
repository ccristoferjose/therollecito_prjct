import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, isUploadEnabled } from "./s3Client.js";

/**
 * Uploads a menu item image.
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @param {string} contentType
 * @returns {Promise<string|null>} The public URL of the image, or null if disabled.
 */
export async function uploadMenuImage(fileBuffer, fileName, contentType) {
  // Graceful degradation: If S3_BUCKET was unset, abort gracefully
  if (!isUploadEnabled) {
    console.warn(`[UploadService] Upload skipped for ${fileName}: S3 is disabled.`);
    // Depending on your app logic, you might return a placeholder URL here instead of null
    return null;
  }

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: fileName,
    Body: fileBuffer,
    ContentType: contentType,
  });

  try {
    // The application-level flow is identical in Dev and Prod
    await s3Client.send(command);

    // Construct and return the public URL
    return `${process.env.S3_PUBLIC_URL_BASE}/${fileName}`;

  } catch (error) {
    console.error(`[UploadService] Failed to upload ${fileName}:`, error);
    throw new Error("Image upload failed");
  }
}
