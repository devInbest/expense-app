export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  /** Number of minor-unit digits (2 for INR paise, 0 for JPY). */
  decimals: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रु', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2 },
];

export const DEFAULT_CURRENCY = 'INR';

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [string, ...string[]];

export const getCurrency = (code: string): CurrencyInfo =>
  CURRENCIES.find((c) => c.code === code) ?? {
    code,
    name: code,
    symbol: code,
    decimals: 2,
  };
