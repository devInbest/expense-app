import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import type { BudgetPeriod, RecurringFrequency } from '@expense/shared';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

export { dayjs };

const safeTz = (tz?: string | null) => {
  try {
    if (tz) {
      dayjs().tz(tz);
      return tz;
    }
  } catch {
    // fall through to default
  }
  return 'Asia/Kolkata';
};

export const inTz = (date: Date | string | Dayjs, tz?: string | null) => dayjs(date).tz(safeTz(tz));

/**
 * Current budget window in the owner's timezone. Weekly runs Monday-Sunday.
 * Custom budgets use their explicit start/end.
 */
export const periodRange = (
  period: BudgetPeriod,
  tz: string | null | undefined,
  ref: Date = new Date(),
  custom?: { startDate?: Date | null; endDate?: Date | null },
): { start: Date; end: Date } => {
  if (period === 'custom' && custom?.startDate && custom?.endDate) {
    return { start: custom.startDate, end: custom.endDate };
  }
  const local = inTz(ref, tz);
  if (period === 'weekly') {
    return { start: local.startOf('isoWeek').toDate(), end: local.endOf('isoWeek').toDate() };
  }
  return { start: local.startOf('month').toDate(), end: local.endOf('month').toDate() };
};

export const previousRange = (start: Date, end: Date) => {
  const length = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - length - 1), end: new Date(start.getTime() - 1) };
};

/**
 * Next occurrence after `from` for a recurring rule. Monthly/yearly rules keep their anchor day,
 * so a rule on the 31st runs on Feb 28/29 and then on Mar 31 again.
 */
export const nextOccurrence = (
  from: Date,
  frequency: RecurringFrequency,
  interval: number,
  anchorDay: number | undefined,
  tz: string | null | undefined,
): Date => {
  const local = inTz(from, tz);
  switch (frequency) {
    case 'daily':
      return local.add(interval, 'day').toDate();
    case 'weekly':
      return local.add(interval, 'week').toDate();
    case 'monthly':
    case 'yearly': {
      const next = local.add(interval, frequency === 'monthly' ? 'month' : 'year');
      const day = Math.min(anchorDay ?? local.date(), next.daysInMonth());
      return next.date(day).toDate();
    }
    default:
      return local.add(1, 'month').toDate();
  }
};

export const utcDateKey = (d: Date) => dayjs.utc(d).format('YYYY-MM-DD');
