import { maskPhone, type PublicUserDTO } from '@expense/shared';
import { User } from './user.model';

type UserLike = {
  _id: unknown;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  status?: string | null;
  upiId?: string | null;
};

export const PUBLIC_USER_FIELDS = 'name username avatarUrl phone status';

export const toPublicUser = (u: UserLike | null | undefined, fallbackId?: string): PublicUserDTO => {
  if (!u) return { _id: fallbackId ?? '', name: 'Former member', deleted: true };
  const deleted = u.status === 'deleted';
  return {
    _id: String(u._id),
    name: deleted ? 'Former member' : u.name || 'Unnamed',
    username: deleted ? undefined : (u.username ?? undefined),
    avatarUrl: deleted ? undefined : (u.avatarUrl ?? undefined),
    phoneHint: deleted ? undefined : maskPhone(u.phone),
    upiId: deleted ? undefined : (u.upiId ?? undefined),
    deleted: deleted || undefined,
  };
};

/** `withUpi` adds UPI IDs; only pass it when the viewer shares a room with these users. */
export const loadPublicUsers = async (ids: string[], opts: { withUpi?: boolean } = {}): Promise<Map<string, PublicUserDTO>> => {
  const unique = [...new Set(ids.map(String))];
  const users = await User.find({ _id: { $in: unique } })
    .select(opts.withUpi ? `${PUBLIC_USER_FIELDS} upiId` : PUBLIC_USER_FIELDS)
    .lean();
  const map = new Map(users.map((u) => [String(u._id), toPublicUser(u)]));
  for (const id of unique) if (!map.has(id)) map.set(id, toPublicUser(null, id));
  return map;
};
