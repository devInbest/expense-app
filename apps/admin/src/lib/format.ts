import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { formatMoney } from '@expense/shared';

dayjs.extend(relativeTime);

export const formatDate = (iso?: string | null) => (iso ? dayjs(iso).format('D MMM YYYY') : '—');
export const formatDateTime = (iso?: string | null) => (iso ? dayjs(iso).format('D MMM YYYY, HH:mm') : '—');
export const fromNow = (iso?: string | null) => (iso ? dayjs(iso).fromNow() : 'Never');

export const formatNumber = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export const money = (minor: number, currency = 'INR') => formatMoney(minor, currency);

export const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

const LABELS: Record<string, string> = {
  split: 'Split group',
  shared_budget: 'Shared budget',
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
  superadmin: 'Superadmin',
  support: 'Support',
};

/** Human label for enum values: known ones are mapped, the rest are de-snaked. */
export const label = (value?: string | null) => {
  if (!value) return '—';
  return LABELS[value] ?? value.replace(/[_.]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};
