import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

/**
 * iDrive E2 — S3-compatible image storage
 * Used to persist uploaded images from the ENT analysis endpoints.
 *
 * Env vars required:
 *   IDRIVE_E2_ENDPOINT       — e.g. https://s3.us-west-4.idrivee2.com
 *   IDRIVE_E2_REGION         — e.g. us-west-4
 *   IDRIVE_E2_ACCESS_KEY_ID
 *   IDRIVE_E2_SECRET_ACCESS_KEY
 *   IDRIVE_E2_BUCKET         — bucket name, e.g. ent-care-images
 */

function getClient(): S3Client {
  const endpoint = process.env.IDRIVE_E2_ENDPOINT;
  const region = process.env.IDRIVE_E2_REGION ?? "us-east-1";
  const accessKeyId = process.env.IDRIVE_E2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.IDRIVE_E2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "iDrive E2 storage is not configured. Set IDRIVE_E2_ENDPOINT, IDRIVE_E2_ACCESS_KEY_ID, and IDRIVE_E2_SECRET_ACCESS_KEY."
    );
  }

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // required for iDrive E2
  });
}

function getBucket(): string {
  return process.env.IDRIVE_E2_BUCKET ?? "ent-system";
}

export interface UploadedImage {
  key: string;        // storage key: "images/2026/11/img_xxxx.jpg"
  url: string;        // public URL (or signed URL if private)
  bucket: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
}

/**
 * Upload a base64-encoded image to iDrive E2.
 * Returns the storage key and a 24-hour signed URL.
 *
 * The consent notice must be shown to the user BEFORE calling this.
 */
export async function uploadImageFromBase64(
  base64Data: string,          // full data URL: "data:image/jpeg;base64,..."
  folder: "analysis" | "escalation" | "reference" = "analysis",
  referenceId?: string         // optional — links image to a case or analysis
): Promise<UploadedImage> {
  // Parse the data URL
  const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid base64 data URL format.");
  }

  const mimeType = match[1];
  const base64Payload = match[2];
  const buffer = Buffer.from(base64Payload, "base64");

  if (buffer.byteLength > 4 * 1024 * 1024) {
    throw new Error("Image too large. Maximum size is 4MB.");
  }

  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const uniqueId = referenceId ?? `img_${crypto.randomBytes(8).toString("hex")}`;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  const key = `${folder}/${date}/${uniqueId}.${ext}`;

  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        referenceId: referenceId ?? uniqueId,
        uploadedAt: new Date().toISOString(),
        consentGiven: "true",
      },
    })
  );

  // Generate a 24-hour signed URL for private access
  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 86400 }
  );

  return {
    key,
    url: signedUrl,
    bucket,
    sizeBytes: buffer.byteLength,
    mimeType,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Generate a fresh signed URL for an existing stored image.
 * Use when a stored URL has expired (after 24h).
 */
export async function getSignedImageUrl(
  key: string,
  expiresInSeconds = 86400
): Promise<string> {
  const client = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

/**
 * Delete an image — used when a user revokes consent.
 */
export async function deleteImage(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
  );
}

/**
 * Verify storage is reachable and bucket exists.
 * Returns true if healthy, false if unreachable.
 */
export async function checkStorageHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const client = getClient();
    await client.send(new HeadBucketCommand({ Bucket: getBucket() }));
    return { healthy: true };
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    if (e?.name === "NotFound" || e?.name === "NoSuchBucket") {
      // Try to create the bucket
      try {
        const client = getClient();
        await client.send(new CreateBucketCommand({ Bucket: getBucket() }));
        return { healthy: true };
      } catch (createErr: unknown) {
        const ce = createErr as { message?: string };
        return { healthy: false, error: `Bucket not found and could not be created: ${ce?.message}` };
      }
    }
    return { healthy: false, error: e?.message ?? "Unknown storage error" };
  }
}

export const STORAGE_CONSENT_NOTICE =
  "Images you upload may be retained for diagnostic quality improvement and specialist review purposes. " +
  "By submitting an image, you acknowledge and consent to this usage. " +
  "You may request deletion of your image at any time by contacting support.";
