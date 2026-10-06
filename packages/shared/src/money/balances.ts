export interface LedgerExpense {
  paidBy: { userId: string; amount: number }[];
  splits: { userId: string; amount: number }[];
}

export interface LedgerSettlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

/** `from` owes `to` this many minor units. */
export interface Debt {
  from: string;
  to: string;
  amount: number;
}

/**
 * Net balance per user. Positive: the group owes them. Negative: they owe the group.
 * The values always sum to zero.
 */
export const computeNetBalances = (
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[] = [],
): Record<string, number> => {
  const net: Record<string, number> = {};
  const add = (userId: string, amount: number) => {
    net[userId] = (net[userId] ?? 0) + amount;
  };

  for (const e of expenses) {
    for (const p of e.paidBy) add(p.userId, p.amount);
    for (const s of e.splits) add(s.userId, -s.amount);
  }
  for (const s of settlements) {
    add(s.fromUserId, s.amount);
    add(s.toUserId, -s.amount);
  }
  return net;
};

/** Greedy matching of debtors to creditors. Deterministic: largest first, ties by userId. */
const matchDebts = (net: Record<string, number>): Debt[] => {
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0)
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));
  const debtors = Object.entries(net)
    .filter(([, v]) => v < 0)
    .map(([userId, amount]) => ({ userId, amount: -amount }))
    .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));

  const debts: Debt[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const pay = Math.min(creditors[c].amount, debtors[d].amount);
    if (pay > 0) debts.push({ from: debtors[d].userId, to: creditors[c].userId, amount: pay });
    creditors[c].amount -= pay;
    debtors[d].amount -= pay;
    if (creditors[c].amount === 0) c += 1;
    if (debtors[d].amount === 0) d += 1;
  }
  return debts;
};

/** Minimum set of payments that clears every balance in the group. */
export const simplifyDebts = (net: Record<string, number>): Debt[] => matchDebts(net);

/** What each person owes the payer(s) for a single expense. */
export const computeExpenseDebts = (expense: LedgerExpense): Debt[] => matchDebts(computeNetBalances([expense]));

/**
 * Who owes whom without cross-member simplification: debts only ever exist between people
 * who shared an expense, netted per pair (A owes B 100 and B owes A 30 becomes A owes B 70).
 */
export const computePairwiseDebts = (
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[] = [],
): Debt[] => {
  const pair = new Map<string, number>();
  const key = (a: string, b: string) => `${a}|${b}`;
  const addDebt = (from: string, to: string, amount: number) => {
    if (from === to || amount === 0) return;
    if (from < to) pair.set(key(from, to), (pair.get(key(from, to)) ?? 0) + amount);
    else pair.set(key(to, from), (pair.get(key(to, from)) ?? 0) - amount);
  };

  for (const e of expenses) {
    for (const d of matchDebts(computeNetBalances([e]))) addDebt(d.from, d.to, d.amount);
  }
  for (const s of settlements) addDebt(s.toUserId, s.fromUserId, s.amount);

  const debts: Debt[] = [];
  for (const [k, amount] of pair) {
    const [a, b] = k.split('|');
    if (amount > 0) debts.push({ from: a, to: b, amount });
    else if (amount < 0) debts.push({ from: b, to: a, amount: -amount });
  }
  return debts.sort((x, y) => y.amount - x.amount || x.from.localeCompare(y.from));
};
