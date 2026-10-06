import type { Request } from 'express';
import { ERROR_CODES, type CompleteOnboardingInput, type UpdateProfileInput } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { verifyGoogleIdToken } from '../../lib/google';
import { logActivity } from '../activity/activity.service';
import { revokeAllSessions } from '../auth/session.service';
import { verifyOtp } from '../auth/otp.service';
import { Budget } from '../budgets/budget.model';
import { Category } from '../categories/category.model';
import { Device } from '../notifications/device.model';
import { Notification } from '../notifications/notification.model';
import { RecurringRule } from '../recurring/recurring.model';
import { linkPhoneInvitesToUser } from '../rooms/invite.service';
import { removeUserFromAllRooms } from '../rooms/room.service';
import { RoomInvite } from '../rooms/room.models';
import { Transaction } from '../transactions/transaction.model';
import { User, type UserDoc } from './user.model';

export const updateProfile = async (user: UserDoc, input: UpdateProfileInput) => {
  if (input.username && input.username !== user.username) {
    const taken = await User.exists({ username: input.username, _id: { $ne: user._id } });
    if (taken) throw ApiError.conflict('That username is taken');
  }
  const { notificationPrefs, email, avatarUrl, upiId, ...rest } = input;
  Object.assign(user, rest);
  if (email !== undefined) user.email = email || undefined;
  if (upiId !== undefined) user.upiId = upiId || undefined;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || undefined;
  if (notificationPrefs) {
    user.notificationPrefs = { ...user.notificationPrefs, ...notificationPrefs } as UserDoc['notificationPrefs'];
  }
  await user.save();
  return user;
};

export const completeOnboarding = async (user: UserDoc, input: CompleteOnboardingInput) => {
  user.name = input.name;
  user.defaultCurrency = input.defaultCurrency;
  user.timezone = input.timezone;
  if (input.locale) user.locale = input.locale;
  user.onboarded = true;
  await user.save();
  return user;
};

export const assertPhoneAvailable = async (phone: string, userId: unknown) => {
  const owner = await User.exists({ phone, _id: { $ne: userId }, status: { $ne: 'deleted' } });
  if (owner) {
    throw ApiError.conflict('This number is already linked to another account. Sign in with it instead.', ERROR_CODES.IDENTITY_IN_USE);
  }
};

export const linkPhone = async (user: UserDoc, phone: string, code: string, req: Request) => {
  await assertPhoneAvailable(phone, user._id);
  await verifyOtp(phone, 'change_phone', code);
  const previous = user.phone;
  user.phone = phone;
  user.phoneVerified = true;
  await user.save();
  await linkPhoneInvitesToUser(String(user._id), phone);
  logActivity({ actorType: 'user', actorId: user._id, action: previous ? 'user.phone_changed' : 'user.phone_linked', req });
  return user;
};

export const linkGoogle = async (user: UserDoc, idToken: string, req: Request) => {
  const profile = await verifyGoogleIdToken(idToken);
  const owner = await User.exists({ googleId: profile.googleId, _id: { $ne: user._id }, status: { $ne: 'deleted' } });
  if (owner) {
    throw ApiError.conflict('This Google account is already linked to another account.', ERROR_CODES.IDENTITY_IN_USE);
  }
  user.googleId = profile.googleId;
  if (!user.email && profile.emailVerified) user.email = profile.email;
  if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
  if (!user.name && profile.name) user.name = profile.name;
  await user.save();
  logActivity({ actorType: 'user', actorId: user._id, action: 'user.google_linked', req });
  return user;
};

/**
 * Store-compliant account deletion: personal data is erased, the profile is anonymised and
 * shared room history stays intact under "Former member" so other members' balances still add up.
 */
export const deleteAccount = async (user: UserDoc, req: Request) => {
  const userId = user._id;
  await removeUserFromAllRooms(String(userId));

  await Promise.all([
    Transaction.deleteMany({ userId }),
    Budget.deleteMany({ ownerType: 'user', ownerId: userId }),
    RecurringRule.deleteMany({ ownerType: 'user', ownerId: userId }),
    Category.deleteMany({ ownerType: 'user', ownerId: userId }),
    Device.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    RoomInvite.updateMany({ invitedBy: userId, status: 'pending' }, { status: 'revoked' }),
    RoomInvite.updateMany({ targetUserId: userId, status: 'pending' }, { status: 'declined', respondedAt: new Date() }),
    revokeAllSessions('user', userId, 'account_deleted'),
  ]);

  await User.updateOne(
    { _id: userId },
    {
      $set: { status: 'deleted', deletedAt: new Date(), name: '', onboarded: false },
      $unset: { phone: 1, googleId: 1, email: 1, username: 1, avatarUrl: 1 },
    },
  );
  logActivity({ actorType: 'user', actorId: userId, action: 'user.deleted', req });
};
