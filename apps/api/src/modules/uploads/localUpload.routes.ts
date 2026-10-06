import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import express, { Router } from 'express';
import { asyncHandler } from '../../core/asyncHandler';
import { ApiError } from '../../core/ApiError';
import { ok } from '../../core/ApiResponse';
import { safeEqual } from '../../lib/crypto';
import { LOCAL_KEY_PATTERN, LOCAL_UPLOAD_DIR, localUploadSignature } from '../../lib/storage';

const router = Router();

/** Receives the PUT that would normally go to S3, authorised by the signature from POST /uploads/sign. */
router.put(
  '/*key',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '10mb' }),
  asyncHandler(async (req, res) => {
    const key = (req.params as { key: string[] }).key.join('/');
    const contentType = (req.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const size = Number(req.query.size);
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? '');

    if (!LOCAL_KEY_PATTERN.test(key)) throw ApiError.badRequest('Invalid upload key');
    if (!exp || Date.now() > exp) throw ApiError.forbidden('Upload link expired');
    if (!safeEqual(sig, localUploadSignature(key, contentType, size, exp))) {
      console.warn(`[local-upload] signature mismatch for ${key} (content-type "${req.get('content-type')}", size ${size})`);
      throw ApiError.forbidden('Invalid upload signature');
    }
    if (!Buffer.isBuffer(req.body) || req.body.length !== size) throw ApiError.badRequest('File size does not match');

    const file = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, req.body);
    ok(res, null, 'Uploaded');
  }),
);

export default router;
