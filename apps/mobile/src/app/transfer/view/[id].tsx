import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import { formatMoney } from '@expense/shared';
import { popup } from '@/components/popup';
import { AppText, Appear, BackdropSlice, Button, Card, Divider, ErrorState, Glass, Icon, Loading, Row, Screen, TAB_BAR_FADE } from '@/components/ui';
import { transferEndpoints, useAccounts, type TransferEndpoint } from '@/lib/accounts';
import { api, errorMessage, isOffline } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Row style={{ paddingVertical: 6, alignItems: 'flex-start' }}>
      <AppText muted={!bold} style={{ flex: 1, fontWeight: bold ? '700' : undefined }}>
        {label}
      </AppText>
      <AppText style={{ flex: 2, textAlign: 'right', fontWeight: bold ? '700' : '500' }}>{value}</AppText>
    </Row>
  );
}

/** One stop on the route: icon tile, a small caption and the account name. */
function RouteStop({ caption, endpoint, filled }: { caption: string; endpoint: TransferEndpoint; filled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Row gap={spacing.md}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? colors.primary : `${colors.primary}1A`,
          borderWidth: 1,
          borderColor: filled ? 'rgba(255,255,255,0.3)' : `${colors.primary}33`,
          boxShadow: filled ? `0 6px 16px ${colors.primaryGlow}` : undefined,
        }}>
        <Icon name={endpoint.icon} size={22} color={filled ? colors.onPrimary : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="caption" muted style={{ fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {caption}
        </AppText>
        <AppText variant="subheading" numberOfLines={1}>
          {endpoint.label}
        </AppText>
      </View>
    </Row>
  );
}

/** From → To as a vertical route: two stops joined by a dashed line carrying the amount. */
function TransferRoute({ from, to, amount }: { from: TransferEndpoint; to: TransferEndpoint; amount: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 0 }}>
      <RouteStop caption="From" endpoint={from} />
      <Row gap={spacing.md} style={{ minHeight: 52 }}>
        {/* Centred under the 44px icon tiles. */}
        <View style={{ width: 44, alignItems: 'center', justifyContent: 'space-evenly', alignSelf: 'stretch', paddingVertical: 4 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: `${colors.primary}80` }} />
          ))}
        </View>
        <Row
          gap={4}
          style={{
            backgroundColor: `${colors.primary}14`,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: 4,
          }}>
          <Icon name="arrow-down" size={14} color={colors.primary} />
          <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {amount}
          </AppText>
        </Row>
      </Row>
      <RouteStop caption="To" endpoint={to} filled />
    </Card>
  );
}

export default function TransferView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const insets = useSafeAreaInsets();
  const [screenHeight, setScreenHeight] = useState(0);
  const transfer = useQuery({ queryKey: qk.transfer(id), queryFn: () => api.transfers.get(id) });

  const remove = useMutation({
    mutationFn: () => api.transfers.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.transfersAll });
      router.back();
    },
    onError: (err) => popup.error('Couldn’t delete transfer', isOffline(err) ? 'Self transfers need an internet connection.' : errorMessage(err)),
  });

  if (transfer.isPending) return <Loading />;
  if (transfer.isError) return <ErrorState message={errorMessage(transfer.error)} onRetry={() => void transfer.refetch()} />;

  const t = transfer.data;
  const endpoints = transferEndpoints(accounts);
  const endpoint = (endpointId: string): TransferEndpoint =>
    endpoints.find((e) => e.id === endpointId) ?? { id: endpointId, label: 'Removed account', icon: 'help-circle-outline' };
  const from = endpoint(t.fromAccount);
  const to = endpoint(t.toAccount);
  const when = new Date(t.occurredAt);
  const amount = formatMoney(t.amount, t.currency);

  const confirmDelete = () =>
    popup.confirm({
      title: 'Delete this transfer?',
      message: 'It will be removed from your self transfers and activity.',
      icon: 'trash-can-outline',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => remove.mutate(),
    });

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
      <Screen edges={[]} contentStyle={{ gap: spacing.md, paddingBottom: 54 + spacing.sm * 2 + TAB_BAR_FADE + spacing.lg + insets.bottom }}>
        <Appear>
          <Glass blur rounded={radius.xl} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, overflow: 'hidden' }}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -110,
                width: 320,
                height: 240,
                experimental_backgroundImage: `radial-gradient(circle at center, ${colors.primary}55 0%, ${colors.primary}00 70%)`,
              }}
            />
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 26,
                backgroundColor: `${colors.primary}22`,
                borderWidth: 1,
                borderColor: `${colors.primary}40`,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="swap-horizontal" size={38} color={colors.primary} />
            </View>
            <View style={{ backgroundColor: `${colors.primary}1A`, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
              <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                Self Transfer
              </AppText>
            </View>
            <AppText variant="display" style={{ fontVariant: ['tabular-nums'] }}>
              {amount}
            </AppText>
          </Glass>
        </Appear>

        <Appear index={1}>
          <TransferRoute from={from} to={to} amount={amount} />
        </Appear>

        <Appear index={2}>
          <Card style={{ gap: spacing.xs }}>
            <AppText variant="subheading" style={{ marginBottom: spacing.xs }}>
              Transfer details
            </AppText>
            <DetailRow label="From" value={from.label} />
            <DetailRow label="To" value={to.label} />
            <DetailRow label="Time" value={when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} />
            <DetailRow label="Date" value={when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} />
            {t.note ? (
              <>
                <Divider />
                <DetailRow label="Note" value={t.note} />
              </>
            ) : null}
            <Divider />
            <DetailRow label="Amount" value={amount} bold />
          </Card>
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
            onPress={() => router.push({ pathname: '/transfer/[id]', params: { id } })}
          />
          <Button
            title="Delete"
            variant="glass"
            color={colors.danger}
            style={{ flex: 1 }}
            loading={remove.isPending}
            onPress={confirmDelete}
          />
        </Row>
      </SafeAreaView>
    </View>
  );
}
