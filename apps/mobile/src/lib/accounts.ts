import { accountKindForMethod, CASH_ACCOUNT_ID, type PaymentAccount, type PaymentAccountKind, type PaymentMethod } from '@expense/shared';
import { useUser } from './auth';

export const ACCOUNT_KIND_LABEL: Record<PaymentAccountKind, string> = { bank: 'Bank account', card: 'Credit card' };
export const ACCOUNT_KIND_ICON: Record<PaymentAccountKind, string> = { bank: 'bank-outline', card: 'credit-card-outline' };

/** "HDFC Savings ••1234" */
export const accountLabel = (a: Pick<PaymentAccount, 'name' | 'last4'>) => (a.last4 ? `${a.name} ••${a.last4}` : a.name);

/** All saved accounts (older cached profiles may not have the field yet). */
export const useAccounts = (): PaymentAccount[] => useUser().accounts ?? [];

/** Saved accounts that fit a payment method: bank accounts for Bank, cards for Card, none otherwise. */
export const accountsForMethod = (accounts: PaymentAccount[], method: PaymentMethod) => {
  const kind = accountKindForMethod(method);
  return kind ? accounts.filter((a) => a.kind === kind) : [];
};

/** The one to preselect: matches the bank SMS's masked digits, or the only saved account of that kind. */
export const defaultAccountId = (options: PaymentAccount[], mask?: string | null) => {
  const digits = mask?.replace(/\D/g, '');
  if (digits) {
    const match = options.find((a) => a.last4 && (a.last4.endsWith(digits) || digits.endsWith(a.last4)));
    if (match) return match.id;
  }
  return options.length === 1 ? options[0]!.id : '';
};

/** Somewhere money can sit for a self transfer: cash, or a saved bank account / card. */
export interface TransferEndpoint {
  id: string;
  label: string;
  icon: string;
}

export const transferEndpoints = (accounts: PaymentAccount[]): TransferEndpoint[] => [
  { id: CASH_ACCOUNT_ID, label: 'Cash', icon: 'cash' },
  ...accounts.map((a) => ({ id: a.id, label: accountLabel(a), icon: ACCOUNT_KIND_ICON[a.kind] })),
];

/** Display name for a transfer end; accounts removed since show as such. */
export const endpointLabel = (id: string, accounts: PaymentAccount[]) => {
  if (id === CASH_ACCOUNT_ID) return 'Cash';
  const account = accounts.find((a) => a.id === id);
  return account ? accountLabel(account) : 'Removed account';
};
