import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import { formatMoney, fromMinor, toMinor, type BudgetPeriod, type BudgetProgressDTO } from '@expense/shared';
import { AmountInput, CategoryGrid } from '@/components/finance';
import { AppText, Button, Card, EmptyState, ErrorState, ErrorText, Loading, ProgressBar, Row, Screen, Section, Segmented, Sheet, ToggleRow } from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';

export default function Budgets() {
  const user = useUser();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { byId, categories } = useCategories();
  const budgets = useQuery({ queryKey: qk.budgets, queryFn: api.budgets.list });
  const [editing, setEditing] = useState<BudgetProgressDTO | 'new' | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.budgets.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.budgets }),
  });

  if (budgets.isLoading) return <Loading />;
  if (budgets.error) return <ErrorState message={errorMessage(budgets.error)} onRetry={() => void budgets.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen
        edges={[]}
        contentStyle={{ flexGrow: 1, paddingBottom: spacing.lg }}
        refreshControl={<RefreshControl refreshing={budgets.isRefetching} onRefresh={() => void budgets.refetch()} />}>
        {budgets.data?.length ? (
          budgets.data.map((b) => {
            const cat = b.categoryId ? byId.get(b.categoryId) : undefined;
            return (
              <Card key={b._id} onPress={() => setEditing(b)}>
                <Row>
                  <AppText variant="subheading" style={{ flex: 1 }}>
                    {cat ? cat.name : 'Overall'} · {b.period}
                  </AppText>
                  <AppText variant="caption" muted>
                    {b.percent}%
                  </AppText>
                </Row>
                <ProgressBar percent={b.percent} />
                <Row>
                  <AppText variant="caption" muted style={{ flex: 1 }}>
                    {formatMoney(b.spent, user.defaultCurrency)} of {formatMoney(b.amount, user.defaultCurrency)}
                  </AppText>
                  <AppText variant="caption" muted>
                    Resets {formatDate(b.periodEnd)}
                  </AppText>
                </Row>
              </Card>
            );
          })
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="target" title="No budgets yet" />
          </View>
        )}
      </Screen>
      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Button title="Add budget" onPress={() => setEditing('new')} />
      </SafeAreaView>

      <BudgetSheet
        key={editing === 'new' ? 'new' : editing?._id ?? 'none'}
        budget={editing}
        currency={user.defaultCurrency}
        categories={categories.filter((c) => c.type === 'expense')}
        onClose={() => setEditing(null)}
        onDelete={(id) =>
          Alert.alert('Delete budget?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id, { onSuccess: () => setEditing(null) }) },
          ])
        }
      />
    </View>
  );
}

function BudgetSheet({
  budget,
  currency,
  categories,
  onClose,
  onDelete,
}: {
  budget: BudgetProgressDTO | 'new' | null;
  currency: string;
  categories: ReturnType<typeof useCategories>['categories'];
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const existing = budget && budget !== 'new' ? budget : null;
  const [scope, setScope] = useState<'overall' | 'category'>(existing && !existing.categoryId ? 'overall' : 'category');
  const [categoryId, setCategoryId] = useState<string | undefined>(existing?.categoryId ?? undefined);
  const [period, setPeriod] = useState<BudgetPeriod>(existing?.period ?? 'monthly');
  const [amount, setAmount] = useState(existing ? String(fromMinor(existing.amount, currency)) : '');
  const [rollover, setRollover] = useState(existing?.rollover ?? false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const minor = toMinor(amount || '0', currency);
      if (minor <= 0) throw new Error('Enter an amount');
      if (existing) return api.budgets.update(existing._id, { amount: minor, rollover });
      if (scope === 'category' && !categoryId) throw new Error('Pick a category');
      return api.budgets.create({ amount: minor, period, rollover, categoryId: scope === 'category' ? categoryId : null });
    },
    onSuccess: () => {
      if (!existing) trackFeature('budget_create');
      void queryClient.invalidateQueries({ queryKey: qk.budgets });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Sheet visible={budget !== null} title={existing ? 'Edit budget' : 'New budget'} onClose={onClose}>
      {!existing ? (
        <>
          <Segmented
            options={[
              { value: 'category', label: 'One category' },
              { value: 'overall', label: 'All spending' },
            ]}
            value={scope}
            onChange={setScope}
          />
          <Segmented
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'weekly', label: 'Weekly' },
            ]}
            value={period}
            onChange={setPeriod}
          />
        </>
      ) : null}
      <AmountInput value={amount} onChange={setAmount} currency={currency} />
      {!existing && scope === 'category' ? (
        <Section title="Category">
          <CategoryGrid categories={categories} value={categoryId} onChange={setCategoryId} />
        </Section>
      ) : null}
      <ToggleRow label="Roll over unused amount" value={rollover} onChange={setRollover} />
      <ErrorText>{error}</ErrorText>
      <View style={{ gap: spacing.sm }}>
        <Button title="Save" onPress={() => save.mutate()} loading={save.isPending} />
        {existing ? <Button title="Delete budget" variant="ghost" onPress={() => onDelete(existing._id)} /> : null}
      </View>
    </Sheet>
  );
}
