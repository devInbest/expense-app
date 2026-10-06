import type { SplitType } from '../constants/enums';

export interface SplitInput {
  userId: string;
  /** exact: minor units; percent: 0-100 (2 decimals); shares: positive weight (2 decimals). Ignored for equal. */
  value?: number;
}

export interface SplitResult {
  userId: string;
  /** The raw value the user entered (percent, shares, exact amount, or 1 for equal). */
  share: number;
  /** Final allocated amount in minor units. */
  amount: number;
}

export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SplitError';
  }
}

/**
 * Largest-remainder allocation of an integer total across integer weights.
 * The result always sums exactly to `total`; ties go to the earlier entry so it is deterministic.
 */
export const allocate = (total: number, weights: number[]): number[] => {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) throw new SplitError('Split weights must add up to more than zero');

  const base = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - base.reduce((a, b) => a + b, 0);

  const order = weights
    .map((w, index) => ({ index, frac: (total * w) % weightSum }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  for (let i = 0; remainder > 0; i = (i + 1) % order.length) {
    base[order[i].index] += 1;
    remainder -= 1;
  }
  return base;
};

const assertUniqueUsers = (inputs: SplitInput[]) => {
  if (inputs.length === 0) throw new SplitError('Pick at least one person to split with');
  const ids = new Set(inputs.map((i) => i.userId));
  if (ids.size !== inputs.length) throw new SplitError('A person appears twice in the split');
};

const toHundredths = (n: number) => Math.round(n * 100);

export const splitEqual = (total: number, inputs: SplitInput[]): SplitResult[] => {
  assertUniqueUsers(inputs);
  const amounts = allocate(total, inputs.map(() => 1));
  return inputs.map((i, idx) => ({ userId: i.userId, share: 1, amount: amounts[idx] }));
};

export const splitExact = (total: number, inputs: SplitInput[]): SplitResult[] => {
  assertUniqueUsers(inputs);
  const results = inputs.map((i) => {
    const amount = Math.round(i.value ?? 0);
    if (amount < 0) throw new SplitError('Amounts cannot be negative');
    return { userId: i.userId, share: amount, amount };
  });
  const sum = results.reduce((a, r) => a + r.amount, 0);
  if (sum !== total) {
    throw new SplitError(`Exact amounts add up to ${sum}, but the expense total is ${total}`);
  }
  return results;
};

export const splitPercent = (total: number, inputs: SplitInput[]): SplitResult[] => {
  assertUniqueUsers(inputs);
  const basisPoints = inputs.map((i) => toHundredths(i.value ?? 0));
  if (basisPoints.some((bp) => bp < 0)) throw new SplitError('Percentages cannot be negative');
  const sum = basisPoints.reduce((a, b) => a + b, 0);
  if (sum !== 10000) {
    throw new SplitError(`Percentages add up to ${sum / 100}%, they must add up to 100%`);
  }
  const amounts = allocate(total, basisPoints);
  return inputs.map((i, idx) => ({ userId: i.userId, share: basisPoints[idx] / 100, amount: amounts[idx] }));
};

export const splitShares = (total: number, inputs: SplitInput[]): SplitResult[] => {
  assertUniqueUsers(inputs);
  const weights = inputs.map((i) => toHundredths(i.value ?? 0));
  if (weights.some((w) => w < 0)) throw new SplitError('Shares cannot be negative');
  const amounts = allocate(total, weights);
  return inputs.map((i, idx) => ({ userId: i.userId, share: weights[idx] / 100, amount: amounts[idx] }));
};

export const computeSplits = (type: SplitType, total: number, inputs: SplitInput[]): SplitResult[] => {
  if (!Number.isInteger(total) || total <= 0) throw new SplitError('Amount must be greater than zero');
  switch (type) {
    case 'equal':
      return splitEqual(total, inputs);
    case 'exact':
      return splitExact(total, inputs);
    case 'percent':
      return splitPercent(total, inputs);
    case 'shares':
      return splitShares(total, inputs);
    default:
      throw new SplitError(`Unknown split type: ${String(type)}`);
  }
};

export interface PayerInput {
  userId: string;
  amount: number;
}

export const validatePayers = (total: number, payers: PayerInput[]): void => {
  if (payers.length === 0) throw new SplitError('Pick who paid');
  const ids = new Set(payers.map((p) => p.userId));
  if (ids.size !== payers.length) throw new SplitError('A payer appears twice');
  if (payers.some((p) => !Number.isInteger(p.amount) || p.amount <= 0)) {
    throw new SplitError('Each payer amount must be greater than zero');
  }
  const sum = payers.reduce((a, p) => a + p.amount, 0);
  if (sum !== total) throw new SplitError(`Paid amounts add up to ${sum}, but the expense total is ${total}`);
};
