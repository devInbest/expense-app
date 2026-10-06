import mongoose, { type InferSchemaType } from 'mongoose';

/** One document per UTC day, written by the nightly stats job. */
const dailyStatSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD (UTC)
    dau: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    transactions: { type: Number, default: 0 },
    roomExpenses: { type: Number, default: 0 },
    roomsCreated: { type: Number, default: 0 },
    settlements: { type: Number, default: 0 },
    appOpens: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type DailyStatAttrs = InferSchemaType<typeof dailyStatSchema>;
export const DailyStat = mongoose.model('DailyStat', dailyStatSchema);
