import { CASH_ACCOUNT_ID, earliestTransferDate, TRANSFER_TOO_OLD_MESSAGE, type CreateTransferInput } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import type { UserDoc } from '../users/user.model';
import { toTransferDTO, Transfer } from './transfer.model';

/**
 * Ends being set must be cash or one of the user's saved accounts, and the two ends must differ.
 * An end that isn't changing may point at an account removed since, so editing the note still works.
 */
export const assertEndpoints = (user: UserDoc, from: string, to: string, changed: string[] = [from, to]) => {
  const ids = new Set([CASH_ACCOUNT_ID, ...(user.accounts ?? []).map((a) => a.id)]);
  if (changed.some((id) => !ids.has(id))) throw ApiError.badRequest('That account no longer exists');
  if (from === to) throw ApiError.badRequest('Pick two different accounts');
};

/** A day of slack covers the device being in a timezone ahead of the server. */
export const assertRecentEnough = (occurredAt: Date) => {
  if (occurredAt.getTime() < earliestTransferDate().getTime() - 86_400_000) throw ApiError.badRequest(TRANSFER_TOO_OLD_MESSAGE);
};

type TransferInput = Omit<CreateTransferInput, 'occurredAt'> & { occurredAt: Date };

export const createTransfer = async (user: UserDoc, input: TransferInput) => {
  assertEndpoints(user, input.fromAccount, input.toAccount);
  assertRecentEnough(input.occurredAt);
  const transfer = await Transfer.create({ ...input, currency: input.currency ?? user.defaultCurrency, userId: user._id });
  return toTransferDTO(transfer.toObject());
};
