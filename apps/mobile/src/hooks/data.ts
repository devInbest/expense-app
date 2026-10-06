import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@expense/api-client';
import type { CategoryDTO, TransactionType } from '@expense/shared';
import { api } from '@/lib/api';
import { CATEGORIES_KEY } from '@/lib/auth';
import { kv } from '@/lib/db';
import { syncStatusStore } from '@/lib/sync';
import { subscribeTransactions, summarize, type LocalSummary } from '@/lib/transactions';

export const useCategories = () => {
  const query = useQuery({
    queryKey: qk.categories,
    queryFn: async () => {
      const list = await api.categories.list();
      await kv.set(CATEGORIES_KEY, list);
      return list;
    },
    staleTime: 5 * 60_000,
  });
  const categories = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(() => new Map(categories.map((c) => [c._id, c])), [categories]);
  return { ...query, categories, byId };
};

export const UNKNOWN_CATEGORY: CategoryDTO = {
  _id: '',
  name: 'Uncategorized',
  icon: 'help-circle-outline',
  color: '#94A3B8',
  type: 'expense',
  ownerType: 'system',
};

/** Runs a local SQLite read and re-runs it whenever local transactions change. */
export const useLocalQuery = <T>(fn: () => Promise<T>, deps: unknown[]) => {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(() => {
    let cancelled = false;
    fnRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => console.warn('Local query failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => run(), deps);
  useEffect(() => subscribeTransactions(() => void run()), [run]);

  return { data, loading, reload: run };
};

/**
 * Local transaction summary over [from, to), with my share of room expenses added to the
 * expense side. Offline, room spending is simply left out until it can be fetched.
 */
export const useSpendingSummary = (from: string, to: string, type: TransactionType = 'expense') => {
  const local = useLocalQuery(() => summarize(from, to, type), [from, to, type]);
  const rooms = useQuery({
    queryKey: qk.roomSpending(from, to),
    queryFn: () => api.rooms.spending({ from, to }),
    staleTime: 60_000,
    enabled: type === 'expense',
  });

  const data = useMemo((): LocalSummary | undefined => {
    const base = local.data;
    const extra = rooms.data;
    if (!base || !extra?.total) return base;

    const byDay = new Map(base.byDay.map((d) => [d.date, { ...d }]));
    for (const d of extra.byDay) {
      const day = byDay.get(d.date) ?? { date: d.date, expense: 0, income: 0 };
      day.expense += d.total;
      byDay.set(d.date, day);
    }
    let byCategory = base.byCategory;
    if (type === 'expense') {
      const cats = new Map(base.byCategory.map((c) => [c.categoryId, { ...c }]));
      for (const c of extra.byCategory) {
        const cat = cats.get(c.categoryId) ?? { categoryId: c.categoryId, total: 0, count: 0 };
        cat.total += c.total;
        cat.count += c.count;
        cats.set(c.categoryId, cat);
      }
      byCategory = [...cats.values()].sort((a, b) => b.total - a.total);
    }
    return {
      ...base,
      expense: base.expense + extra.total,
      count: base.count + extra.count,
      byCategory,
      byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [local.data, rooms.data, type]);

  const reload = () => {
    local.reload();
    void rooms.refetch();
  };
  return { data, loading: local.loading, reload };
};

export const useSyncStatus = () => useSyncExternalStore(syncStatusStore.subscribe, syncStatusStore.getSnapshot);
