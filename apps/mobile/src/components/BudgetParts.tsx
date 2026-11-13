import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { qk } from '@expense/api-client';
import type { BudgetProgressDTO, CategoryDTO } from '@expense/shared';
import { AppText, Card, Icon, Row } from '@/components/ui';
import { api } from '@/lib/api';
import { spacing, useTheme } from '@/theme';

/** The budgets list, shared by the Budgets page and the budget pages (same cache). */
export const useBudgets = () => useQuery({ queryKey: qk.budgets, queryFn: api.budgets.list });

/** One budget from the list, or `undefined` while loading / `null` once loaded if it no longer exists. */
export function useBudget(id: string): { budget: BudgetProgressDTO | null | undefined; query: ReturnType<typeof useBudgets> } {
  const query = useBudgets();
  const budget = query.data ? (query.data.find((b) => b._id === id) ?? null) : undefined;
  return { budget, query };
}

export const budgetName = (budget: Pick<BudgetProgressDTO, 'categoryId'>, categoryById: Map<string, CategoryDTO>) =>
  budget.categoryId ? (categoryById.get(budget.categoryId)?.name ?? 'Category') : 'All spending';

export const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/** Fixed row height so the view (On/Off text) and edit (Switch) versions are the same size. */
export function RolloverCard({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingVertical: spacing.sm }}>
      <Row style={{ height: 36 }}>
        <Icon name="autorenew" size={20} color={colors.primary} />
        <AppText style={{ flex: 1 }}>Roll over unused amount</AppText>
        {children}
      </Row>
    </Card>
  );
}
