import type { TransactionType } from './enums';

export interface DefaultCategory {
  key: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
}

/** Seeded as system categories. `icon` is a MaterialCommunityIcons name. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { key: 'food', name: 'Food & Dining', icon: 'silverware-fork-knife', color: '#F97316', type: 'expense' },
  { key: 'groceries', name: 'Groceries', icon: 'cart', color: '#22C55E', type: 'expense' },
  { key: 'transport', name: 'Transport', icon: 'car', color: '#3B82F6', type: 'expense' },
  { key: 'fuel', name: 'Fuel', icon: 'gas-station', color: '#0EA5E9', type: 'expense' },
  { key: 'rent', name: 'Rent', icon: 'home', color: '#8B5CF6', type: 'expense' },
  { key: 'utilities', name: 'Bills & Utilities', icon: 'flash', color: '#EAB308', type: 'expense' },
  { key: 'shopping', name: 'Shopping', icon: 'shopping', color: '#EC4899', type: 'expense' },
  { key: 'entertainment', name: 'Entertainment', icon: 'movie-open', color: '#A855F7', type: 'expense' },
  { key: 'health', name: 'Health', icon: 'medical-bag', color: '#EF4444', type: 'expense' },
  { key: 'education', name: 'Education', icon: 'school', color: '#14B8A6', type: 'expense' },
  { key: 'travel', name: 'Travel', icon: 'airplane', color: '#06B6D4', type: 'expense' },
  { key: 'subscriptions', name: 'Subscriptions', icon: 'repeat', color: '#6366F1', type: 'expense' },
  { key: 'gifts', name: 'Gifts & Donations', icon: 'gift', color: '#F43F5E', type: 'expense' },
  { key: 'personal_care', name: 'Personal Care', icon: 'face-woman-shimmer', color: '#D946EF', type: 'expense' },
  { key: 'uncategorized', name: 'Uncategorized', icon: 'tag-outline', color: '#64748B', type: 'expense' },
  { key: 'salary', name: 'Salary', icon: 'briefcase', color: '#16A34A', type: 'income' },
  { key: 'business', name: 'Business', icon: 'store', color: '#0D9488', type: 'income' },
  { key: 'investment', name: 'Investments', icon: 'chart-line', color: '#2563EB', type: 'income' },
  { key: 'refund', name: 'Refunds', icon: 'cash-refund', color: '#65A30D', type: 'income' },
  { key: 'other_income', name: 'Other Income', icon: 'cash-plus', color: '#4D7C0F', type: 'income' },
];

export const UNCATEGORIZED_KEY = 'uncategorized';
