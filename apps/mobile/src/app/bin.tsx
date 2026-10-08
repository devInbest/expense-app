import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { TransactionRow } from '@/components/finance';
import { AppText, Backdrop, Banner, EmptyState, Glass, IconButton, Loading, Row } from '@/components/ui';
import { useCategories, useLocalQuery } from '@/hooks/data';
import { formatDay } from '@/lib/dates';
import { listTransactions, setTransactionBinned, type LocalTransaction } from '@/lib/transactions';
import { spacing, useTheme } from '@/theme';

export default function Bin() {
  const { colors } = useTheme();
  const { byId } = useCategories();
  const [showInfo, setShowInfo] = useState(false);
  const { data: items } = useLocalQuery(() => listTransactions({ binned: true, limit: 500 }), []);

  const sections = useMemo(() => {
    const groups = new Map<string, LocalTransaction[]>();
    for (const tx of items ?? []) {
      const key = new Date(tx.occurredAt).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), tx]);
    }
    return [...groups.entries()].map(([key, data]) => ({ title: formatDay(key), data }));
  }, [items]);

  const header = (
    <Stack.Screen
      options={{
        title: 'Bin',
        headerTitleStyle: { fontSize: 20, fontWeight: '700' },
        headerRight: () => (
          <IconButton icon="information-outline" label="About the bin" size={24} color={colors.textMuted} onPress={() => setShowInfo((v) => !v)} />
        ),
      }}
    />
  );

  if (items === undefined)
    return (
      <>
        {header}
        <Loading />
      </>
    );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      {header}
      <SectionList
        sections={sections}
        keyExtractor={(tx) => tx.clientId}
        contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={showInfo ? <Banner text="Binned transactions aren’t counted in your totals. Restore one to bring it back." /> : null}
        renderSectionHeader={({ section }) => (
          <AppText variant="label" muted style={{ paddingTop: spacing.md, paddingHorizontal: spacing.xs }}>
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <Glass style={{ paddingHorizontal: spacing.md, paddingVertical: 2 }}>
            <Row gap={spacing.sm}>
              <View style={{ flex: 1 }}>
                <TransactionRow
                  tx={item}
                  category={byId.get(item.categoryId)}
                  onPress={() => router.push({ pathname: '/transaction/view/[id]', params: { id: item.clientId } })}
                />
              </View>
              <IconButton glass icon="restore" label="Restore transaction" color={colors.primary} onPress={() => void setTransactionBinned(item.clientId, false)} />
            </Row>
          </Glass>
        )}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="trash-can-outline" title="Bin is empty" message="Transactions you move to the bin show up here." />
          </View>
        }
      />
    </View>
  );
}
