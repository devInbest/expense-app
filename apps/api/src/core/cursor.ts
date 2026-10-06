import mongoose from 'mongoose';

/**
 * Keyset cursor over (date desc, _id desc). Stable under inserts, unlike skip/limit,
 * which matters for infinite scroll while new expenses keep arriving.
 */
export const encodeCursor = (date: Date, id: unknown) => `${date.getTime()}_${String(id)}`;

export const cursorFilter = (cursor: string | undefined, field: string) => {
  if (!cursor) return {};
  const [ms, id] = cursor.split('_');
  const time = Number(ms);
  if (!Number.isFinite(time) || !id || !mongoose.isValidObjectId(id)) return {};
  const date = new Date(time);
  return {
    $or: [{ [field]: { $lt: date } }, { [field]: date, _id: { $lt: new mongoose.Types.ObjectId(id) } }],
  };
};

export const pageOf = <T extends { _id: unknown }>(docs: T[], limit: number, field: keyof T) => {
  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last[field] as unknown as Date, last._id) : null,
  };
};
