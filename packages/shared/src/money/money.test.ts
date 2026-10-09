import { describe, expect, it } from 'vitest';
import {
  allocate,
  computeNetBalances,
  computePairwiseDebts,
  computeSplits,
  simplifyDebts,
  SplitError,
  validatePayers,
} from './index';
import { fromMinor, toMinor } from './format';

const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);

describe('allocate', () => {
  it('always sums to the total', () => {
    for (const total of [1, 2, 99, 100, 101, 1000, 999_999]) {
      for (const weights of [[1], [1, 1], [1, 1, 1], [3, 2, 5], [1, 0, 1], [3333, 3333, 3334]]) {
        const out = allocate(total, weights);
        expect(out.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it('gives remainders to the earliest entries on ties', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(101, [1, 1, 1])).toEqual([34, 34, 33]);
  });

  it('rejects zero weights', () => {
    expect(() => allocate(100, [0, 0])).toThrow(SplitError);
  });
});

describe('computeSplits', () => {
  const users = ['a', 'b', 'c'].map((userId) => ({ userId }));

  it('splits equally with paise remainders', () => {
    const out = computeSplits('equal', 10000, users);
    expect(out.map((s) => s.amount)).toEqual([3334, 3333, 3333]);
    expect(sum(out)).toBe(10000);
  });

  it('validates exact amounts', () => {
    expect(() =>
      computeSplits('exact', 1000, [
        { userId: 'a', value: 500 },
        { userId: 'b', value: 400 },
      ]),
    ).toThrow(/must add up to the total/);
    const ok = computeSplits('exact', 1000, [
      { userId: 'a', value: 600 },
      { userId: 'b', value: 400 },
    ]);
    expect(ok.map((s) => s.amount)).toEqual([600, 400]);
  });

  it('splits by percent and requires 100%', () => {
    const out = computeSplits('percent', 999, [
      { userId: 'a', value: 50 },
      { userId: 'b', value: 25 },
      { userId: 'c', value: 25 },
    ]);
    expect(sum(out)).toBe(999);
    // 499.5 / 249.75 / 249.75: the two leftover paise go to the largest fractions.
    expect(out.map((s) => s.amount)).toEqual([499, 250, 250]);
    expect(() =>
      computeSplits('percent', 1000, [
        { userId: 'a', value: 50 },
        { userId: 'b', value: 40 },
      ]),
    ).toThrow(/100%/);
  });

  it('handles decimal percentages like 33.33', () => {
    const out = computeSplits('percent', 10000, [
      { userId: 'a', value: 33.33 },
      { userId: 'b', value: 33.33 },
      { userId: 'c', value: 33.34 },
    ]);
    expect(sum(out)).toBe(10000);
  });

  it('splits by shares', () => {
    const out = computeSplits('shares', 1000, [
      { userId: 'a', value: 2 },
      { userId: 'b', value: 1 },
      { userId: 'c', value: 1 },
    ]);
    expect(out.map((s) => s.amount)).toEqual([500, 250, 250]);
  });

  it('rejects duplicates, empty lists and non-positive totals', () => {
    expect(() => computeSplits('equal', 100, [])).toThrow(SplitError);
    expect(() => computeSplits('equal', 100, [{ userId: 'a' }, { userId: 'a' }])).toThrow(/twice/);
    expect(() => computeSplits('equal', 0, users)).toThrow(SplitError);
  });
});

describe('validatePayers', () => {
  it('requires payers to cover the total', () => {
    expect(() => validatePayers(1000, [{ userId: 'a', amount: 600 }])).toThrow(SplitError);
    expect(() =>
      validatePayers(1000, [
        { userId: 'a', amount: 600 },
        { userId: 'b', amount: 400 },
      ]),
    ).not.toThrow();
  });
});

describe('balances', () => {
  // Trip: A pays 3000 dinner split 3 ways, B pays 1500 cab split A/B.
  const expenses = [
    {
      paidBy: [{ userId: 'a', amount: 3000 }],
      splits: [
        { userId: 'a', amount: 1000 },
        { userId: 'b', amount: 1000 },
        { userId: 'c', amount: 1000 },
      ],
    },
    {
      paidBy: [{ userId: 'b', amount: 1500 }],
      splits: [
        { userId: 'a', amount: 750 },
        { userId: 'b', amount: 750 },
      ],
    },
  ];

  it('nets to zero', () => {
    const net = computeNetBalances(expenses);
    expect(net).toEqual({ a: 1250, b: -250, c: -1000 });
    expect(Object.values(net).reduce((x, y) => x + y, 0)).toBe(0);
  });

  it('applies settlements', () => {
    const net = computeNetBalances(expenses, [{ fromUserId: 'c', toUserId: 'a', amount: 1000 }]);
    expect(net).toEqual({ a: 250, b: -250, c: 0 });
  });

  it('simplifies debts to the minimum payments', () => {
    const debts = simplifyDebts(computeNetBalances(expenses));
    expect(debts).toEqual([
      { from: 'c', to: 'a', amount: 1000 },
      { from: 'b', to: 'a', amount: 250 },
    ]);
  });

  it('computes pairwise debts netted per pair', () => {
    const debts = computePairwiseDebts(expenses);
    expect(debts).toEqual([
      { from: 'c', to: 'a', amount: 1000 },
      { from: 'b', to: 'a', amount: 250 },
    ]);
  });

  it('chains collapse when simplified', () => {
    // A owes B 100, B owes C 100 -> A pays C directly.
    const chain = [
      { paidBy: [{ userId: 'b', amount: 100 }], splits: [{ userId: 'a', amount: 100 }] },
      { paidBy: [{ userId: 'c', amount: 100 }], splits: [{ userId: 'b', amount: 100 }] },
    ];
    expect(simplifyDebts(computeNetBalances(chain))).toEqual([{ from: 'a', to: 'c', amount: 100 }]);
    expect(computePairwiseDebts(chain)).toHaveLength(2);
  });

  it('handles multiple payers', () => {
    const multi = [
      {
        paidBy: [
          { userId: 'a', amount: 600 },
          { userId: 'b', amount: 400 },
        ],
        splits: [
          { userId: 'a', amount: 250 },
          { userId: 'b', amount: 250 },
          { userId: 'c', amount: 250 },
          { userId: 'd', amount: 250 },
        ],
      },
    ];
    const net = computeNetBalances(multi);
    expect(net).toEqual({ a: 350, b: 150, c: -250, d: -250 });
    const debts = simplifyDebts(net);
    expect(debts.reduce((x, d) => x + d.amount, 0)).toBe(500);
  });
});

describe('format', () => {
  it('converts major and minor units', () => {
    expect(toMinor('12.50')).toBe(1250);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor('1,234.56')).toBe(123456);
    expect(toMinor(100, 'JPY')).toBe(100);
    expect(fromMinor(1250)).toBe(12.5);
  });
});
