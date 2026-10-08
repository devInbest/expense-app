import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { qk } from '@expense/api-client';
import { computeExpenseDebts, formatMoney, type PaymentMethod, type RoomExpenseDTO } from '@expense/shared';
import { Money } from '@/components/finance';
import { PaySheet, type PayDetails } from '@/components/PaySheet';
import { AppText, BottomBar, Avatar, Button, Card, CategoryIcon, ErrorState, Icon, Loading, Row, Screen, Section } from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { useRoom } from '@/hooks/rooms';
import { api, errorMessage } from '@/lib/api';
import { formatDay } from '@/lib/dates';
import { radius, spacing, useTheme } from '@/theme';

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank', other: 'Other' };

export default function RoomExpenseDetail() {
  const { id, expenseId } = useLocalSearchParams<{
    id: string;
    expenseId: string;
  }>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { byId } = useCategories();
  const r = useRoom(id);
  const [paying, setPaying] = useState<PayDetails | null>(null);

  const expense = useQuery({
    queryKey: qk.roomExpense(id, expenseId),
    queryFn: () => api.rooms.expense(id, expenseId),
    initialData: () =>
      queryClient
        .getQueryData<{ pages: { items: RoomExpenseDTO[] }[] }>(qk.roomExpenses(id))
        ?.pages.flatMap((p) => p.items)
        .find((e) => e._id === expenseId),
  });

  const mark = useMutation({
    mutationFn: ({ userId, paid }: { userId: string; paid: boolean }) => api.rooms.markSharePaid(id, expenseId, userId, paid),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.roomExpense(id, expenseId), updated);
      void queryClient.invalidateQueries({ queryKey: qk.room(id) });
    },
    onError: (err) => Alert.alert('Could not update', errorMessage(err)),
  });
  const e = expense.data;
  const owes = useMemo(() => {
    const map = new Map<string, number>();
    if (e) for (const d of computeExpenseDebts(e)) map.set(d.from, (map.get(d.from) ?? 0) + d.amount);
    return map;
  }, [e]);

  if (!e || !r.room) {
    if (expense.error) return <ErrorState message={errorMessage(expense.error)} onRetry={() => void expense.refetch()} />;
    return <Loading />;
  }

  const room = r.room;
  const isSplit = room.type === 'split';
  const category = e.categoryId ? byId.get(e.categoryId) : undefined;
  const canEdit = r.canEditExpense(e);
  const canMark = r.canMarkPaid(e);
  const debtors = e.splits.filter((s) => owes.has(s.userId));
  const paidCount = debtors.filter((s) => s.paidAt).length;
  const myOwed = debtors.some((s) => s.userId === r.me && !s.paidAt) ? owes.get(r.me) : undefined;
  const payeeUpi = e.upiId || r.members.find((m) => m.user._id === e.createdBy)?.user.upiId;
  const payment = myOwed ? { upiId: payeeUpi, payeeName: r.name(e.createdBy), amount: myOwed, currency: room.currency } : null;
  const toggle = (userId: string, paid: boolean) => {
    if (paid) return mark.mutate({ userId, paid });
    Alert.alert('Mark as unpaid?', `${r.name(userId)}'s payment for this expense will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark unpaid',
        style: 'destructive',
        onPress: () => mark.mutate({ userId, paid }),
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen edges={[]} contentStyle={{ paddingBottom: spacing.lg }}>
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs }}>
          <CategoryIcon icon={category?.icon ?? 'receipt'} color={category?.color ?? colors.primary} size={56} />
          <AppText variant="subheading" numberOfLines={2} style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {e.note || category?.name || 'Expense'}
          </AppText>
          <Money amount={e.amount} currency={room.currency} variant="title" />
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
            {[e.note && category ? category.name : null, formatDay(e.occurredAt), `Added by ${r.name(e.createdBy)}`].filter(Boolean).join(' · ')}
          </AppText>
          {e.settledAt ? (
            <StatusPill icon="check-decagram" text="Fully settled" color={colors.success} />
          ) : isSplit && debtors.length ? (
            <StatusPill icon="clock-outline" text={`${paidCount} of ${debtors.length} paid`} color={colors.warning} />
          ) : null}
        </Card>

        <Section title="Paid by">
          <Card>
            {e.paidBy.map((p) => (
              <Row key={p.userId} style={{ paddingVertical: 4 }}>
                <Avatar {...r.avatar(p.userId)} size={32} />
                <View style={{ flex: 1 }}>
                  <AppText>{r.name(p.userId)}</AppText>
                  <AppText variant="caption" muted>
                    {`via ${METHOD_LABEL[e.paymentMethod] ?? 'UPI'}`}
                  </AppText>
                </View>
                <AppText>{formatMoney(p.amount, room.currency)}</AppText>
              </Row>
            ))}
          </Card>
        </Section>

        {isSplit ? (
          <Section title="Split between">
            <Card>
              {e.splits.map((s) => {
                const owed = owes.get(s.userId);
                const busy = mark.isPending && mark.variables?.userId === s.userId;
                return (
                  <Row key={s.userId} style={{ paddingVertical: 6 }}>
                    <Avatar {...r.avatar(s.userId)} size={32} />
                    <View style={{ flex: 1 }}>
                      <AppText>{r.name(s.userId)}</AppText>
                      <AppText variant="caption" muted>
                        {owed && !s.paidAt
                          ? `Owes ${formatMoney(owed, room.currency)}`
                          : `Share ${formatMoney(s.amount, room.currency)}`}
                      </AppText>
                    </View>
                    {!owed ? (
                      <AppText variant="caption" muted>
                        {e.paidBy.some((p) => p.userId === s.userId) ? 'Paid the bill' : '—'}
                      </AppText>
                    ) : busy ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : s.paidAt ? (
                      <PaidPill onPress={canMark ? () => toggle(s.userId, false) : undefined} />
                    ) : canMark ? (
                      <Button title="Mark paid" compact variant="secondary" disabled={mark.isPending} onPress={() => toggle(s.userId, true)} />
                    ) : s.userId === r.me && !r.archived ? (
                      <Button title="Pay" compact onPress={() => setPaying(payment)} />
                    ) : (
                      <AppText variant="caption" color={colors.warning}>
                        Pending
                      </AppText>
                    )}
                  </Row>
                );
              })}
            </Card>
          </Section>
        ) : null}

        {!canEdit && !e.settledAt && e.createdBy !== r.me ? (
          <Row gap={spacing.xs} style={{ justifyContent: 'center' }}>
            <Icon name="information-outline" size={14} color={colors.textMuted} />
            <AppText variant="caption" muted style={{ textTransform: 'capitalize' }}>
              Only {r.name(e.createdBy)} can modify this expense
            </AppText>
          </Row>
        ) : null}
      </Screen>
      {canEdit ? (
        <BottomBar>
          <Button
            title="Edit expense"
            onPress={() =>
              router.push({
                pathname: '/room/[id]/expense',
                params: { id, expenseId },
              })
            }
          />
        </BottomBar>
      ) : null}
      {paying ? <PaySheet visible onClose={() => setPaying(null)} payment={paying} /> : null}
    </View>
  );
}

function StatusPill({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: `${color}1A`,
      }}>
      <Icon name={icon} size={14} color={color} />
      <AppText variant="caption" color={color} style={{ fontWeight: '600' }}>
        {text}
      </AppText>
    </View>
  );
}

function PaidPill({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Paid. Tap to mark as unpaid' : 'Paid'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: `${colors.success}1A`,
      }}>
      <Icon name="check" size={14} color={colors.success} />
      <AppText variant="caption" color={colors.success} style={{ fontWeight: '600' }}>
        Paid
      </AppText>
    </Pressable>
  );
}
