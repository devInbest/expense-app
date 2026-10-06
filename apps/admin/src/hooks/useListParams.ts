import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';

/**
 * List state (page, search text, filters) kept in the URL, so the back button from a
 * detail page restores the list. The search box is debounced before it hits the URL.
 */
export function useListParams<F extends string>(filterKeys: readonly F[]) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debounced] = useDebouncedValue(search.trim(), 350);

  const update = useCallback(
    (changes: Record<string, string | number | null | undefined>, resetPage = true) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v === null || v === undefined || v === '') next.delete(k);
            else next.set(k, String(v));
          }
          if (resetPage && !('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  useEffect(() => {
    if (debounced !== (params.get('q') ?? '')) update({ q: debounced });
  }, [debounced, params, update]);

  const filters = Object.fromEntries(filterKeys.map((k) => [k, params.get(k) ?? undefined])) as Record<F, string | undefined>;

  return {
    page,
    q: params.get('q') ?? undefined,
    filters,
    search,
    setSearch,
    setPage: (p: number) => update({ page: p > 1 ? p : null }, false),
    setFilter: (key: F, value: string | null) => update({ [key]: value }),
    setFilters: (changes: Partial<Record<F, string | null>>) => update(changes),
  };
}
