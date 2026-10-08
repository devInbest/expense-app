import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Alert, RefreshControl, Switch, View } from 'react-native';
import { qk } from '@expense/api-client';
import { formatMoney, fromMinor, toMinor, type BudgetPeriod, type BudgetProgressDTO, type CategoryDTO } from '@expense/shared';
import { AmountInput, CategoryGrid } from '@/components/finance';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  Appear,
  BackdropSlice,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  ErrorState,
  ErrorText,
  Glass,
  Icon,
  Loading,
  ProgressBar,
  Row,
  Screen,
  Section,
  Segmented,
  Sheet,
  TAB_BAR_FADE,
} from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';

export default function Budgets() {
  const user = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [screenHeight, setScreenHeight] = useState(0);
  const queryClient = useQueryClient();
  const { byId, categories } = useCategories();
  const budgets = useQuery({ queryKey: qk.budgets, queryFn: api.budgets.list });
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const selectedBudget = selected === 'new' ? 'new' : (budgets.data?.find((b) => b._id === selected) ?? null);

  const remove = useMutation({
    mutationFn: (id: string) => api.budgets.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.budgets }),
  });

  if (budgets.isLoading) return <Loading />;
  if (budgets.error) return <ErrorState message={errorMessage(budgets.error)} onRetry={() => void budgets.refetch()} />;

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
      <Screen
        edges={[]}
        contentStyle={{
          flexGrow: 1,
          paddingBottom: 54 + spacing.lg + TAB_BAR_FADE + spacing.sm + insets.bottom,
        }}
        refreshControl={
          <RefreshControl refreshing={budgets.isRefetching} onRefresh={() => void budgets.refetch()} tintColor={colors.primary} colors={[colors.primary]} />
        }>
        {budgets.data?.length ? (
          budgets.data.map((b) => {
            const cat = b.categoryId ? byId.get(b.categoryId) : undefined;
            return (
              <Card key={b._id} onPress={() => setSelected(b._id)}>
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
      <SafeAreaView
        edges={['bottom']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.lg,
          paddingTop: TAB_BAR_FADE,
          paddingBottom: spacing.sm,
        }}>
        <BackdropSlice fade={TAB_BAR_FADE} screenHeight={screenHeight || undefined} />
        <Button title="Add budget" onPress={() => setSelected('new')} />
      </SafeAreaView>

      <BudgetSheet
        key={selected ?? 'none'}
        budget={selectedBudget}
        currency={user.defaultCurrency}
        categories={categories.filter((c) => c.type === 'expense')}
        categoryById={byId}
        onClose={() => setSelected(null)}
        onDelete={(id) =>
          Alert.alert('Delete budget?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => remove.mutate(id, { onSuccess: () => setSelected(null) }),
            },
          ])
        }
      />
    </View>
  );
}

const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/** Opens read-only for an existing budget; "Edit" swaps in the form, and saving returns to the details. */
function BudgetSheet({
  budget,
  currency,
  categories,
  categoryById,
  onClose,
  onDelete,
}: {
  budget: BudgetProgressDTO | 'new' | null;
  currency: string;
  categories: ReturnType<typeof useCategories>['categories'];
  categoryById: Map<string, CategoryDTO>;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const existing = budget && budget !== 'new' ? budget : null;
  const [editing, setEditing] = useState(!existing);
  const name = existing?.categoryId ? (categoryById.get(existing.categoryId)?.name ?? 'Category') : 'Overall';
  const title = !existing ? 'New budget' : editing ? `${name} Budget` : 'Budget';
  return (
    <Sheet visible={budget !== null} title={title} icon={existing && editing ? 'pencil-outline' : undefined} onClose={onClose}>
      {existing && !editing ? (
        <BudgetDetails
          budget={existing}
          currency={currency}
          categoryById={categoryById}
          onEdit={() => setEditing(true)}
          onDelete={() => onDelete(existing._id)}
        />
      ) : (
        <BudgetForm
          existing={existing}
          currency={currency}
          categories={categories}
          onSaved={existing ? () => setEditing(false) : onClose}
          onCancel={existing ? () => setEditing(false) : undefined}
        />
      )}
    </Sheet>
  );
}

function BudgetDetails({
  budget,
  currency,
  categoryById,
  onEdit,
  onDelete,
}: {
  budget: BudgetProgressDTO;
  currency: string;
  categoryById: Map<string, CategoryDTO>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const cat = budget.categoryId ? categoryById.get(budget.categoryId) : undefined;
  const over = budget.remaining < 0;
  const tone = budget.percent >= 100 ? colors.danger : budget.percent >= 80 ? colors.warning : colors.primary;
  const daysLeft = daysUntil(budget.periodEnd);
  const perDay = !over && daysLeft > 0 ? Math.floor(budget.remaining / daysLeft) : 0;
  const fmt = (n: number) => formatMoney(n, currency);
  const stats = [
    { label: 'Budget', value: fmt(budget.amount) },
    { label: 'Spent', value: fmt(budget.spent) },
    { label: 'Days left', value: String(daysLeft) },
    { label: 'Per Day Budget', value: over ? '—' : fmt(perDay) },
  ];

  return (
    <>
      <Appear>
        <Glass blur style={{ padding: spacing.lg, gap: spacing.xs }} rounded={28}>
          <Row style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <CategoryIcon icon={cat?.icon ?? 'target'} color={cat?.color ?? colors.primary} size={44} square />
            <AppText variant="subheading" numberOfLines={1} style={{ flex: 1, fontWeight: '700' }}>
              {cat ? cat.name : 'All spending'}
            </AppText>
            <View
              style={{
                backgroundColor: colors.primaryMuted,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                paddingVertical: 4,
              }}>
              <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700', textTransform: 'capitalize' }}>
                {budget.period}
              </AppText>
            </View>
          </Row>
          <AppText variant="caption" muted>
            {over ? 'Over budget by' : 'Left to spend'}
          </AppText>
          <AppText variant="display" color={over ? colors.danger : colors.text} style={{ fontVariant: ['tabular-nums'] }}>
            {fmt(Math.abs(budget.remaining))}
          </AppText>
          <View
            style={{
              alignSelf: 'stretch',
              gap: spacing.xs,
              marginTop: spacing.sm,
            }}>
            <ProgressBar percent={budget.percent} height={10} color={tone} />
            <Row>
              <AppText variant="caption" muted style={{ flex: 1 }}>
                {budget.percent}% used
              </AppText>
              <AppText variant="caption" muted>
                {formatDate(budget.periodStart)} – {formatDate(budget.periodEnd)}
              </AppText>
            </Row>
          </View>
        </Glass>
      </Appear>

      <Appear index={1} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {stats.map((s) => (
          <Glass
            key={s.label}
            style={{
              flexBasis: '47%',
              flexGrow: 1,
              padding: spacing.md,
              gap: 2,
            }}>
            <AppText variant="caption" muted style={{ fontWeight: '600' }}>
              {s.label}
            </AppText>
            <AppText variant="subheading" style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {s.value}
            </AppText>
          </Glass>
        ))}
      </Appear>

      <View style={{ marginTop: 'auto', gap: spacing.sm }}>
        <Appear index={2}>
          <RolloverCard>
            <AppText muted style={{ fontWeight: '600' }}>
              {budget.rollover ? 'On' : 'Off'}
            </AppText>
          </RolloverCard>
        </Appear>

        <Appear index={3} style={{ gap: spacing.sm }}>
          <Button title="Edit" icon="pencil-outline" onPress={onEdit} />
          <Button title="Delete" icon="delete-outline" variant="glass" color={colors.danger} onPress={onDelete} />
        </Appear>
      </View>
    </>
  );
}

/** Fixed row height so the view (On/Off text) and edit (Switch) versions are the same size. */
function RolloverCard({ children }: { children: ReactNode }) {
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

function BudgetForm({
  existing,
  currency,
  categories,
  onSaved,
  onCancel,
}: {
  existing: BudgetProgressDTO | null;
  currency: string;
  categories: ReturnType<typeof useCategories>['categories'];
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
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
      return api.budgets.create({
        amount: minor,
        period,
        rollover,
        categoryId: scope === 'category' ? categoryId : null,
      });
    },
    onSuccess: async () => {
      if (!existing) trackFeature('budget_create');
      await queryClient.invalidateQueries({ queryKey: qk.budgets });
      onSaved();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <>
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
      <View style={{ gap: spacing.sm, marginTop: 'auto' }}>
        <RolloverCard>
          <Switch
            value={rollover}
            onValueChange={setRollover}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.surfaceAlt}
          />
        </RolloverCard>
        <ErrorText>{error}</ErrorText>
        <Button title="Save" onPress={() => save.mutate()} loading={save.isPending} />
        {onCancel ? <Button title="Cancel" variant="glass" onPress={onCancel} /> : null}
      </View>
    </>
  );
}
