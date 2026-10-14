import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, AppState, FlatList, Linking, Platform, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import type { BankTxnStatus } from '@expense/shared';
import { BankTxnRow } from '@/components/BankTxnRow';
import { TabHeader } from '@/components/TabHeader';
import { AppText, Appear, Backdrop, Banner, Button, Card, CategoryIcon, EmptyState, ErrorState, Loading, RevealScope, Row, Segmented, useRevealList, useTabBarInset } from '@/components/ui';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage, showError } from '@/lib/api';
import { isSmsImportEnabled, requestSmsPermission, scanBankSms, SMS_ACCESS_KEY, smsImportSupported } from '@/lib/bankSms';
import { radius, spacing, useTheme } from '@/theme';

const TABS: { value: BankTxnStatus; label: string }[] = [
  { value: 'pending', label: 'Transactions' },
  { value: 'linked', label: 'Marked' },
  { value: 'ignored', label: 'Ignored' },
];

const EMPTY_MESSAGE: Record<BankTxnStatus, string> = {
  pending: 'No New Transactions',
  linked: 'No Marked Transactions Yet',
  ignored: 'No Ignored Transactions',
};

type SetupState = 'unsupported' | 'off' | 'on';

const listQuery = (status: BankTxnStatus) => ({
  queryKey: qk.bankTransactions(status),
  queryFn: ({ pageParam }: { pageParam: string | undefined }) => api.bank.list({ status, cursor: pageParam }),
  initialPageParam: undefined as string | undefined,
});

export default function BankInbox() {
  const { colors } = useTheme();
  const tabInset = useTabBarInset();
  const queryClient = useQueryClient();
  const reveal = useRevealList();
  const [status, setStatus] = useState<BankTxnStatus>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const list = useInfiniteQuery({ ...listQuery(status), getNextPageParam: (last) => last.nextCursor ?? undefined });

  // Load every section up front so switching between them shows cached data instead of a spinner.
  useEffect(() => {
    for (const t of TABS) void queryClient.prefetchInfiniteQuery(listQuery(t.value));
  }, [queryClient]);

  const smsSetup = useQuery({
    queryKey: SMS_ACCESS_KEY,
    queryFn: (): SetupState => (!smsImportSupported ? 'unsupported' : isSmsImportEnabled() ? 'on' : 'off'),
  });
  const setup: SetupState | 'loading' = smsSetup.data ?? 'loading';

  // Access may have been granted in system Settings while the app was in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void queryClient.invalidateQueries({ queryKey: SMS_ACCESS_KEY });
    });
    return () => sub.remove();
  }, [queryClient]);

  const scan = async () => {
    try {
      const added = await scanBankSms();
      await queryClient.invalidateQueries({ queryKey: qk.bankAll });
      return added;
    } catch (err) {
      showError(err, "Couldn't read bank SMS");
      return 0;
    }
  };

  const enable = async () => {
    const result = await requestSmsPermission();
    if (result === 'blocked') {
      Alert.alert('SMS access is off', 'Allow SMS access for this app in Settings to import bank transactions.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    if (result !== 'granted') return;
    trackFeature('bank_sms_enabled');
    await smsSetup.refetch();
    const added = await scan();
    if (added === 0) Alert.alert('No bank transactions found', 'We looked at the last 60 days of SMS. New bank alerts will show up here as they arrive.');
  };

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const pending = list.data?.pages[0]?.pending ?? 0;

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <TabHeader title="Bank" />
      {pending && status === 'pending' ? <Banner icon="bank-transfer" text={`${pending} bank transaction${pending > 1 ? 's' : ''} to review`} /> : null}
      {setup === 'unsupported' && Platform.OS !== 'android' ? (
        <Banner icon="information-outline" text="Bank SMS can only be read on Android. Transactions imported on your Android phone show up here too." />
      ) : null}
      <Segmented
        options={TABS}
        value={status}
        onChange={setStatus}
      />
    </View>
  );

  if (setup === 'off') {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <SafeAreaView edges={['top']} style={{ flex: 1, padding: spacing.lg, paddingBottom: tabInset + spacing.lg }}>
          <TabHeader title="Bank" />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EnableCard onEnable={enable} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <RevealScope scrollY={reveal.scrollY}>
          <FlatList
            data={items}
            keyExtractor={(t) => t._id}
            contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: tabInset + spacing.lg }}
            showsVerticalScrollIndicator={false}
            onScroll={reveal.onScroll}
            scrollEventThrottle={reveal.scrollEventThrottle}
            ListHeaderComponent={header}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  try {
                    if (setup === 'on') await scan();
                    else await queryClient.invalidateQueries({ queryKey: qk.bankAll });
                  } finally {
                    setRefreshing(false);
                  }
                }}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            onEndReached={() => list.hasNextPage && void list.fetchNextPage()}
            ListEmptyComponent={
              list.isLoading || setup === 'loading' ? (
                <Loading />
              ) : list.error ? (
                <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
              ) : (
                <EmptyState icon="bank-outline" title="Nothing is Here" message={EMPTY_MESSAGE[status]} />
              )
            }
            renderItem={({ item, index }) => {
              const first = index === 0;
              const last = index === items.length - 1;
              return (
                <Appear
                  index={index}
                  style={{
                    paddingHorizontal: spacing.md,
                    backgroundColor: colors.glass,
                    borderColor: colors.glassBorder,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderTopWidth: first ? 1 : 0,
                    borderBottomWidth: last ? 1 : 0,
                    borderTopLeftRadius: first ? radius.lg : 0,
                    borderTopRightRadius: first ? radius.lg : 0,
                    borderBottomLeftRadius: last ? radius.lg : 0,
                    borderBottomRightRadius: last ? radius.lg : 0,
                  }}>
                  <BankTxnRow item={item} onPress={() => router.push({ pathname: '/bank/[id]', params: { id: item._id } })} />
                </Appear>
              );
            }}
          />
        </RevealScope>
      </SafeAreaView>
    </View>
  );
}

function EnableCard({ onEnable }: { onEnable: () => Promise<void> }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const points = [
    { icon: 'message-text-outline', text: 'Finds debit and credit alerts from any bank in your SMS.' },
    { icon: 'shield-lock-outline', text: 'Messages are read on this phone. Only the amount, date, bank and who it was with are saved.' },
    { icon: 'gesture-tap', text: 'You decide what each one is: an expense, income, or a room payment.' },
  ];
  return (
    <Card style={{ gap: spacing.md }}>
      <Row gap={spacing.md}>
        <CategoryIcon icon="bank-transfer" color={colors.primary} size={44} square />
        <View style={{ flex: 1 }}>
          <AppText variant="subheading">Import from bank SMS</AppText>
          <AppText variant="caption" muted>
            Never miss a UPI or card payment again
          </AppText>
        </View>
      </Row>
      {points.map((p) => (
        <Row key={p.icon} style={{ alignItems: 'flex-start' }}>
          <CategoryIcon icon={p.icon} color={colors.textMuted} size={28} />
          <AppText muted style={{ flex: 1 }}>
            {p.text}
          </AppText>
        </Row>
      ))}
      <Button
        title="Allow SMS access"
        icon="message-lock-outline"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onEnable();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}
