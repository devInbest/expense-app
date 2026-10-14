import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { qk } from '@expense/api-client';
import {
  formatMoney,
  fromMinor,
  LIMITS,
  toMinor,
  type BankTransactionDTO,
  type BankTxnStatus,
  type CreateTransactionInput,
  type RoomDTO,
  type RoomExpenseDTO,
  type TransactionType,
} from '@expense/shared';
import { bankTxnSource, bankTxnTitle, LINK_LABEL } from '@/components/BankTxnRow';
import { AmountInput, CategoryGrid } from '@/components/finance';
import {
  AppText,
  Appear,
  Avatar,
  Banner,
  Button,
  Card,
  Divider,
  ErrorState,
  ErrorText,
  Field,
  Glass,
  Icon,
  ListItem,
  Loading,
  Row,
  Screen,
  Section,
  Segmented,
} from '@/components/ui';
import { UNKNOWN_CATEGORY, useCategories } from '@/hooks/data';
import { useRoom } from '@/hooks/rooms';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDate, formatTime } from '@/lib/dates';
import { applyServerIfClean, emitTransactionsChanged } from '@/lib/transactions';
import { radius, spacing, useTheme } from '@/theme';

const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank transfer', other: 'Other' } as const;

const TITLE: Record<BankTxnStatus, string> = { pending: 'Transaction', linked: 'Marked', ignored: 'Ignored' };

type Mode = 'personal' | 'room';
type RoomMode = 'room_expense' | 'room_payment';

export default function BankReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: qk.bankTransaction(id), queryFn: () => api.bank.get(id) });

  const item = query.data;

  return (
    <Screen edges={['bottom']} contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.lg }}>
      <Stack.Screen options={{ title: item ? TITLE[item.status] : '' }} />
      {query.isLoading ? (
        <Loading />
      ) : query.error || !item ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <Summary item={item} />
          {item.status === 'pending' ? <PendingActions item={item} /> : item.status === 'linked' ? <LinkedInfo item={item} /> : <IgnoredInfo item={item} />}
        </>
      )}
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ paddingVertical: 6, alignItems: 'flex-start' }}>
      <AppText muted style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText style={{ flex: 2, textAlign: 'right', fontWeight: '500' }}>{value}</AppText>
    </Row>
  );
}

function Summary({ item }: { item: BankTransactionDTO }) {
  const { colors } = useTheme();
  const debit = item.direction === 'debit';
  const tone = debit ? colors.danger : colors.income;
  return (
    <Appear>
      <Glass blur rounded={radius.xl} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
        <View style={{ backgroundColor: `${tone}1A`, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
          <AppText variant="caption" color={tone} style={{ fontWeight: '700' }}>
            {debit ? 'Money sent' : 'Money received'}
          </AppText>
        </View>
        <AppText variant="display" style={{ fontVariant: ['tabular-nums'] }}>
          {formatMoney(item.amount, item.currency)}
        </AppText>
        <AppText variant="subheading" numberOfLines={2} style={{ textAlign: 'center' }}>
          {debit ? 'To ' : 'From '}
          {bankTxnTitle(item)}
        </AppText>
      </Glass>
      <Card style={{ gap: 0, marginTop: spacing.md }}>
        {bankTxnSource(item) ? <DetailRow label="Account" value={bankTxnSource(item)} /> : null}
        <DetailRow label="When" value={`${formatDate(item.occurredAt)}, ${formatTime(item.occurredAt)}`} />
        <DetailRow label="Via" value={METHOD_LABEL[item.paymentMethod]} />
        {item.reference ? <DetailRow label="Reference" value={item.reference} /> : null}
      </Card>
    </Appear>
  );
}

const useAfterSave = () => {
  const queryClient = useQueryClient();
  return (roomId?: string) => {
    void queryClient.invalidateQueries({ queryKey: qk.bankAll });
    if (roomId) {
      void queryClient.invalidateQueries({ queryKey: qk.room(roomId) });
      void queryClient.invalidateQueries({ queryKey: qk.roomSpendingAll });
    }
    router.back();
  };
};

function PendingActions({ item }: { item: BankTransactionDTO }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('personal');

  const ignore = useMutation({
    mutationFn: () => api.bank.ignore(item._id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.bankAll });
      router.back();
    },
    onError: (err) => Alert.alert("Couldn't ignore", errorMessage(err)),
  });

  return (
    <>
      <Section title="Save As">
        <Segmented
          options={[
            { value: 'personal', label: 'Personal' },
            { value: 'room', label: 'Room' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Section>
      {mode === 'personal' ? <PersonalForm item={item} /> : <RoomActions item={item} />}
      <Button
        title="Ignore"
        icon="eye-off-outline"
        variant="glass"
        color={colors.danger}
        style={{ marginTop: -spacing.sm }}
        loading={ignore.isPending}
        onPress={() => ignore.mutate()}
      />
    </>
  );
}

function PersonalForm({ item }: { item: BankTransactionDTO }) {
  const { categories } = useCategories();
  const afterSave = useAfterSave();
  const [clientId] = useState(() => Crypto.randomUUID());
  const type: TransactionType = item.direction === 'credit' ? 'income' : 'expense';
  const [amount, setAmount] = useState(String(fromMinor(item.amount, item.currency)));
  const [categoryId, setCategoryId] = useState<string | undefined>(item.suggestion?.categoryId);
  const [note, setNote] = useState(item.counterparty);
  const [error, setError] = useState<string | null>(null);
  const visible = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const selected = visible.some((c) => c._id === categoryId) ? categoryId : undefined;

  const save = useMutation({
    mutationFn: () => {
      const minor = toMinor(amount || '0', item.currency);
      if (minor <= 0) throw new Error('Enter an amount');
      if (minor > LIMITS.MAX_AMOUNT_MINOR) throw new Error('That amount is too large');
      if (!selected) throw new Error('Pick a category');
      return api.bank.link(item._id, {
        kind: 'transaction',
        transaction: {
          clientId,
          type,
          amount: minor,
          currency: item.currency as CreateTransactionInput['currency'],
          categoryId: selected,
          note: note.trim(),
          paymentMethod: item.paymentMethod,
          occurredAt: item.occurredAt,
          tags: [],
        },
      });
    },
    onSuccess: async (res) => {
      if (res.transaction) {
        await applyServerIfClean(res.transaction);
        emitTransactionsChanged();
      }
      trackFeature('bank_txn_personal');
      afterSave();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <>
      <AmountInput value={amount} onChange={setAmount} currency={item.currency} />
      <Section title="Category">
        {item.suggestion && selected === item.suggestion.categoryId ? (
          <AppText variant="caption" muted>
            Suggested from the last time you paid {item.counterparty}
          </AppText>
        ) : null}
        <CategoryGrid categories={visible} value={selected} onChange={setCategoryId} />
      </Section>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="What was it for?" maxLength={280} />
      <ErrorText>{error}</ErrorText>
      <Button title={type === 'income' ? 'Save as Income' : 'Save as Expense'} icon="check" loading={save.isPending} onPress={() => save.mutate()} />
    </>
  );
}

/** Active rooms the user can act in; `split` limits to rooms that track who owes whom. */
const useRoomChoices = (filter: (room: RoomDTO) => boolean) => {
  const rooms = useQuery({ queryKey: [...qk.rooms, { showArchived: false }], queryFn: () => api.rooms.list(false) });
  return { ...rooms, choices: (rooms.data ?? []).filter((r) => !r.archivedAt && filter(r)) };
};

function RoomList({ rooms, onPick, empty }: { rooms: RoomDTO[]; onPick: (room: RoomDTO) => void; empty: string }) {
  if (!rooms.length) return <Banner icon="account-group-outline" text={empty} />;
  return (
    <Card style={{ paddingVertical: spacing.xs, gap: 0 }}>
      {rooms.map((room, i) => (
        <View key={room._id}>
          {i ? <Divider /> : null}
          <ListItem icon={room.icon} title={room.name} subtitle={room.type === 'split' ? 'Split room' : 'Shared budget'} onPress={() => onPick(room)} />
        </View>
      ))}
    </Card>
  );
}

/** Money received can't be a room bill, so credits go straight to marking a share as paid back. */
function RoomActions({ item }: { item: BankTransactionDTO }) {
  const debit = item.direction === 'debit';
  const [roomMode, setRoomMode] = useState<RoomMode>(debit ? 'room_expense' : 'room_payment');
  return (
    <>
      {debit ? (
        <Segmented
          options={[
            { value: 'room_expense', label: 'Expense' },
            { value: 'room_payment', label: 'Pay back' },
          ]}
          value={roomMode}
          onChange={setRoomMode}
        />
      ) : null}
      {roomMode === 'room_expense' ? <RoomExpensePicker item={item} /> : <RoomPaymentPicker item={item} />}
    </>
  );
}

function RoomExpensePicker({ item }: { item: BankTransactionDTO }) {
  const rooms = useRoomChoices((r) => r.myRole === 'owner' || r.myRole === 'admin' || r.settings.membersCanAddExpense !== false);
  if (rooms.isLoading) return <Loading />;
  return (
    <Section title="Which room was this bill for?">
      <RoomList
        rooms={rooms.choices}
        empty="You aren't in any room where you can add expenses."
        onPick={(room) => router.push({ pathname: '/room/[id]/expense', params: { id: room._id, bankTxnId: item._id } })}
      />
    </Section>
  );
}

function RoomPaymentPicker({ item }: { item: BankTransactionDTO }) {
  const rooms = useRoomChoices((r) => r.type === 'split');
  const [roomId, setRoomId] = useState<string | null>(null);
  if (rooms.isLoading) return <Loading />;
  if (roomId) return <ShareCandidates item={item} roomId={roomId} onBack={() => setRoomId(null)} />;
  return (
    <Section title={item.direction === 'debit' ? 'Which room did you pay back?' : 'Which room is this from?'}>
      <RoomList rooms={rooms.choices} empty="You aren't in any split rooms." onPick={(room) => setRoomId(room._id)} />
    </Section>
  );
}

interface Candidate {
  expense: RoomExpenseDTO;
  userId: string;
  amount: number;
}

/**
 * Unpaid shares this payment could settle: for money I sent, my shares of others' expenses;
 * for money I received, others' shares of expenses I added. Exact amount matches come first.
 */
function ShareCandidates({ item, roomId, onBack }: { item: BankTransactionDTO; roomId: string; onBack: () => void }) {
  const { colors } = useTheme();
  const me = useUser()._id;
  const r = useRoom(roomId);
  const { byId } = useCategories();
  const afterSave = useAfterSave();
  const expenses = useQuery({ queryKey: [...qk.roomExpenses(roomId), 'unpaid'], queryFn: () => api.rooms.expenses(roomId, { limit: 100 }) });
  const currency = r.room?.currency ?? item.currency;

  const candidates: Candidate[] = [];
  for (const e of expenses.data?.items ?? []) {
    if (e.settledAt) continue;
    if (item.direction === 'debit') {
      const mine = e.createdBy !== me && e.splits.find((s) => s.userId === me && !s.paidAt && s.amount > 0);
      if (mine) candidates.push({ expense: e, userId: me, amount: mine.amount });
    } else if (e.createdBy === me) {
      for (const s of e.splits) if (s.userId !== me && !s.paidAt && s.amount > 0) candidates.push({ expense: e, userId: s.userId, amount: s.amount });
    }
  }
  candidates.sort((a, b) => Number(b.amount === item.amount) - Number(a.amount === item.amount) || b.expense.occurredAt.localeCompare(a.expense.occurredAt));

  const link = useMutation({
    mutationFn: (c: Candidate) => api.bank.link(item._id, { kind: 'room_payment', roomId, expenseId: c.expense._id, userId: c.userId }),
    onSuccess: () => {
      trackFeature('bank_txn_room_payment');
      afterSave(roomId);
    },
    onError: (err) => Alert.alert("Couldn't save", errorMessage(err)),
  });

  const label = (e: RoomExpenseDTO) => e.note || (e.categoryId ? (byId.get(e.categoryId) ?? UNKNOWN_CATEGORY).name : 'an expense');

  const confirm = (c: Candidate) => {
    const amount = formatMoney(c.amount, currency);
    const message =
      item.direction === 'debit'
        ? `Your ${amount} share of "${label(c.expense)}" will be marked paid, and ${r.name(c.expense.createdBy)} will be notified.`
        : `${r.name(c.userId)}'s ${amount} share of "${label(c.expense)}" will be marked paid.`;
    Alert.alert('Mark as paid?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark paid', onPress: () => link.mutate(c) },
    ]);
  };

  if (expenses.isLoading || !r.room) return <Loading />;
  if (expenses.error) return <ErrorState message={errorMessage(expenses.error)} onRetry={() => void expenses.refetch()} />;

  return (
    <Section title={r.room.name} action={<Button title="Change room" compact variant="ghost" onPress={onBack} />}>
      {candidates.length ? (
        <Card style={{ paddingVertical: spacing.xs, gap: 0 }}>
          {candidates.map((c, i) => {
            const who = item.direction === 'debit' ? c.expense.createdBy : c.userId;
            const exact = c.amount === item.amount;
            return (
              <View key={`${c.expense._id}-${c.userId}`}>
                {i ? <Divider /> : null}
                <ListItem
                  left={<Avatar {...r.avatar(who)} size={36} />}
                  title={item.direction === 'debit' ? `Your share of ${label(c.expense)}` : `${r.name(c.userId)} · ${label(c.expense)}`}
                  subtitle={[item.direction === 'debit' ? `Paid by ${r.name(c.expense.createdBy)}` : null, formatDate(c.expense.occurredAt), exact ? 'Amount matches' : null]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    <Row gap={4}>
                      {exact ? <Icon name="check-circle" size={16} color={colors.success} /> : null}
                      <AppText style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatMoney(c.amount, currency)}</AppText>
                    </Row>
                  }
                  onPress={() => confirm(c)}
                />
              </View>
            );
          })}
        </Card>
      ) : (
        <Banner
          icon="check-all"
          text={item.direction === 'debit' ? 'You have no unpaid shares in this room.' : 'Nobody owes you on expenses you added in this room.'}
        />
      )}
      {link.isPending ? <Loading /> : null}
    </Section>
  );
}

function LinkedInfo({ item }: { item: BankTransactionDTO }) {
  const link = item.link;
  if (!link) return null;
  const open = () => {
    if (link.kind === 'transaction') router.push({ pathname: '/transaction/view/[id]', params: { id: link.id } });
    else if (link.roomId) router.push({ pathname: '/room/[id]/expense-detail', params: { id: link.roomId, expenseId: link.id } });
  };
  return (
    <>
      <Banner tone="success" icon="check-circle-outline" text={`${LINK_LABEL[link.kind]}. Nothing else to do here.`} />
      <Button title="Open" icon="open-in-new" variant="secondary" onPress={open} />
    </>
  );
}

function IgnoredInfo({ item }: { item: BankTransactionDTO }) {
  const queryClient = useQueryClient();
  const restore = useMutation({
    mutationFn: () => api.bank.restore(item._id),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.bankTransaction(item._id), updated);
      void queryClient.invalidateQueries({ queryKey: qk.bankAll });
    },
    onError: (err) => Alert.alert("Couldn't restore", errorMessage(err)),
  });
  return (
    <>
      <Banner tone="warning" icon="eye-off-outline" text="You ignored this. It isn't in your totals." />
      <Button title="Move back to review" icon="undo" variant="secondary" loading={restore.isPending} onPress={() => restore.mutate()} />
    </>
  );
}
