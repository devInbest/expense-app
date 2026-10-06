import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { ApiError } from '../core/ApiError';
import { hmac, uuid } from './crypto';

let client: S3Client | null = null;

const isS3Configured = () => Boolean(env.storage.bucket && env.storage.accessKeyId && env.storage.secretAccessKey);

/** Dev-only fallback so uploads work without a bucket. Never used in production (Render's disk is ephemeral) or tests. */
export const localUploadsEnabled = () => env.isDev && !isS3Configured();

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
export const LOCAL_KEY_PATTERN = /^(avatars|receipts)\/[a-f0-9]{24}\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

const getClient = () => {
  const s = env.storage;
  if (!isS3Configured()) {
    throw new ApiError(503, 'File uploads are not configured on the server', 'INTERNAL');
  }
  client ??= new S3Client({
    region: s.region,
    endpoint: s.endpoint || undefined,
    forcePathStyle: Boolean(s.endpoint),
    credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
  });
  return client;
};

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const localUploadSignature = (key: string, contentType: string, size: number, exp: number) =>
  hmac(`local-upload:${key}:${contentType}:${size}:${exp}`);

/**
 * Pre-signed PUT so the app uploads straight to S3/R2 (Render's disk is ephemeral).
 * The signature pins content type and length, so the client cannot upload something else.
 */
export const signUpload = async (opts: { folder: string; ownerId: string; contentType: string; size: number; baseUrl: string }) => {
  const key = `${opts.folder}/${opts.ownerId}/${new Date().toISOString().slice(0, 7)}/${uuid()}.${EXT[opts.contentType] ?? 'bin'}`;
  const headers = { 'Content-Type': opts.contentType };

  if (localUploadsEnabled()) {
    const exp = Date.now() + 5 * 60_000;
    const sig = localUploadSignature(key, opts.contentType, opts.size, exp);
    const query = new URLSearchParams({ size: String(opts.size), exp: String(exp), sig });
    return {
      uploadUrl: `${opts.baseUrl}/api/v1/uploads/local/${key}?${query}`,
      publicUrl: `${opts.baseUrl}/uploads/${key}`,
      headers,
    };
  }

  const command = new PutObjectCommand({
    Bucket: env.storage.bucket,
    Key: key,
    ContentType: opts.contentType,
    ContentLength: opts.size,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 300 });
  const base = env.storage.publicUrl || `https://${env.storage.bucket}.s3.${env.storage.region}.amazonaws.com`;
  return {
    uploadUrl,
    publicUrl: `${base.replace(/\/$/, '')}/${key}`,
    headers,
  };
};
