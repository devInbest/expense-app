import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '@expense/shared';
import { useBudgets } from '@/components/BudgetParts';
import { BudgetSheet, type BudgetEditing } from '@/components/BudgetSheet';
import { AppText, BackdropSlice, Button, Card, EmptyState, ErrorState, Loading, ProgressBar, Row, Screen, TAB_BAR_FADE } from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';

export default function Budgets() {
  const user = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [screenHeight, setScreenHeight] = useState(0);
  const { byId } = useCategories();
  const budgets = useBudgets();
  const [editing, setEditing] = useState<BudgetEditing>(null);

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
              <Card key={b._id} onPress={() => router.push({ pathname: '/budget/view/[id]', params: { id: b._id } })}>
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
            <EmptyState icon="target" title="Nothing is Here" message="Add a budget to track spending." />
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
        <Button title="Add budget" onPress={() => setEditing('new')} />
      </SafeAreaView>

      <BudgetSheet key={editing ? 'open' : 'closed'} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
