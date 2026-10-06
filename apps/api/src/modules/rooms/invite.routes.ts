import { Router } from 'express';
import { asyncHandler } from '../../core/asyncHandler';
import { ok } from '../../core/ApiResponse';
import { getRoomDetail } from './room.service';
import { acceptInvite, declineInvite, myInvites } from './invite.service';

const router = Router();

router.get('/', asyncHandler(async (req, res) => ok(res, await myInvites(req.user!._id))));

router.post(
  '/:id/accept',
  asyncHandler(async (req, res) => {
    const roomId = await acceptInvite(String(req.params.id), req.user!, req);
    ok(res, await getRoomDetail(String(roomId), req.user!._id), 'Joined room');
  }),
);

router.post(
  '/:id/decline',
  asyncHandler(async (req, res) => {
    await declineInvite(String(req.params.id), req.user!);
    ok(res, null, 'Invite declined');
  }),
);

export default router;
