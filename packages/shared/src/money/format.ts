import { getCurrency } from '../constants/currencies';

const pow10 = (n: number) => 10 ** n;

/** Major-unit input (e.g. "12.50" rupees) to integer minor units (1250 paise). */
export const toMinor = (major: number | string, currency = 'INR'): number => {
  const value = typeof major === 'string' ? Number(major.replace(/,/g, '')) : major;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * pow10(getCurrency(currency).decimals));
};

/** Integer minor units to a major-unit number. Only for display / inputs. */
export const fromMinor = (minor: number, currency = 'INR'): number =>
  minor / pow10(getCurrency(currency).decimals);

export const formatMoney = (
  minor: number,
  currency = 'INR',
  options: { locale?: string; compact?: boolean; signed?: boolean } = {},
): string => {
  const info = getCurrency(currency);
  const major = fromMinor(minor, currency);
  try {
    const formatted = new Intl.NumberFormat(options.locale ?? (currency === 'INR' ? 'en-IN' : 'en-US'), {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: options.compact ? 0 : info.decimals,
      maximumFractionDigits: info.decimals,
      notation: options.compact ? 'compact' : 'standard',
      signDisplay: options.signed ? 'exceptZero' : 'auto',
    }).format(major);
    return formatted;
  } catch {
    const sign = major < 0 ? '-' : options.signed && major > 0 ? '+' : '';
    return `${sign}${info.symbol}${Math.abs(major).toFixed(info.decimals)}`;
  }
};
