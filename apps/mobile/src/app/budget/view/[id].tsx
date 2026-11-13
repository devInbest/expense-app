import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import { formatMoney } from '@expense/shared';
import { budgetName, daysUntil, RolloverCard, useBudget } from '@/components/BudgetParts';
import { BudgetSheet, type BudgetEditing } from '@/components/BudgetSheet';
import { popup } from '@/components/popup';
import {
  AppText,
  Appear,
  BackdropSlice,
  Banner,
  Button,
  Card,
  CategoryIcon,
  ErrorState,
  Glass,
  Loading,
  ProgressBar,
  Row,
  Screen,
  TAB_BAR_FADE,
} from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';

/** A budget's progress, with Edit and Delete. */
export default function BudgetView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { byId } = useCategories();
  const { budget, query } = useBudget(id);
  const [screenHeight, setScreenHeight] = useState(0);
  const [editing, setEditing] = useState<BudgetEditing>(null);
  const remove = useMutation({
    mutationFn: () => api.budgets.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.budgets });
      router.back();
    },
    onError: (err) => popup.error('Couldn’t delete', errorMessage(err)),
  });

  if (query.error) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (budget === undefined) return <Loading />;
  if (!budget) {
    return (
      <Screen edges={['bottom']}>
        <Banner icon="alert-circle-outline" tone="warning" text="This budget was deleted." />
      </Screen>
    );
  }

  const currency = user.defaultCurrency;
  const cat = budget.categoryId ? byId.get(budget.categoryId) : undefined;
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

  const confirmDelete = () =>
    popup.confirm({
      title: 'Delete budget?',
      icon: 'trash-can-outline',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => remove.mutate(),
    });

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
      <Stack.Screen options={{ title: `${budgetName(budget, byId)} budget` }} />
      <Screen edges={[]} contentStyle={{ gap: spacing.lg, paddingBottom: 54 + spacing.sm * 2 + TAB_BAR_FADE + spacing.lg + insets.bottom }}>
        <Appear>
          <Glass blur style={{ padding: spacing.lg, gap: spacing.xs }} rounded={28}>
            <Row style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <CategoryIcon icon={cat?.icon ?? 'target'} color={cat?.color ?? colors.primary} size={44} square />
              <AppText variant="subheading" numberOfLines={1} style={{ flex: 1, fontWeight: '700' }}>
                {cat ? cat.name : 'All spending'}
              </AppText>
              <View style={{ backgroundColor: colors.primaryMuted, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
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
            <View style={{ alignSelf: 'stretch', gap: spacing.xs, marginTop: spacing.sm }}>
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
            <Glass key={s.label} style={{ flexBasis: '47%', flexGrow: 1, padding: spacing.md, gap: 2 }}>
              <AppText variant="caption" muted style={{ fontWeight: '600' }}>
                {s.label}
              </AppText>
              <AppText variant="subheading" style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {s.value}
              </AppText>
            </Glass>
          ))}
        </Appear>

        {budget.note ? (
          <Appear index={2}>
            <Card style={{ gap: spacing.xs }}>
              <AppText variant="caption" muted style={{ fontWeight: '600' }}>
                Note
              </AppText>
              <AppText>{budget.note}</AppText>
            </Card>
          </Appear>
        ) : null}

        <Appear index={3}>
          <RolloverCard>
            <AppText muted style={{ fontWeight: '600' }}>
              {budget.rollover ? 'On' : 'Off'}
            </AppText>
          </RolloverCard>
        </Appear>
      </Screen>

      <SafeAreaView
        edges={['bottom']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: TAB_BAR_FADE, paddingBottom: spacing.sm }}>
        <BackdropSlice fade={TAB_BAR_FADE} screenHeight={screenHeight || undefined} />
        <Row style={{ gap: spacing.sm }}>
          <Button
            title="Edit"
            variant="glass"
            color={colors.primary}
            style={{ flex: 1 }}
            onPress={() => setEditing(budget)}
          />
          <Button title="Delete" variant="glass" color={colors.danger} style={{ flex: 1 }} loading={remove.isPending} onPress={confirmDelete} />
        </Row>
      </SafeAreaView>

      <BudgetSheet key={editing ? `edit-${budget._id}` : 'closed'} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
