import { Router } from 'express';
import { signUploadSchema } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { validate } from '../../core/validate';
import { signUpload } from '../../lib/storage';

const router = Router();

router.post(
  '/sign',
  validate(signUploadSchema),
  asyncHandler(async (req, res) => {
    const { purpose, contentType, size } = req.body;
    const result = await signUpload({
      folder: purpose === 'avatar' ? 'avatars' : 'receipts',
      ownerId: String(req.user!._id),
      contentType,
      size,
      baseUrl: `${req.protocol}://${req.get('host')}`,
    });
    ok(res, result);
  }),
);

export default router;
