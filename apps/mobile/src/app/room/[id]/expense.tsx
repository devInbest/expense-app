import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { qk } from '@expense/api-client';
import {
  computeSplits,
  formatMoney,
  fromMinor,
  PAYMENT_METHOD_VALUES,
  toMinor,
  type PaymentMethod,
  type RoomExpenseDTO,
  type SplitType,
} from '@expense/shared';
import { AmountInput, CategoryGrid, DateField } from '@/components/finance';
import { AppText, Avatar, Banner, Button, Card, Chip, ErrorText, Field, Icon, Loading, Row, Screen, Section, Segmented } from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { useRoom } from '@/hooks/rooms';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank', other: 'Other' };

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'exact', label: 'Exact amount' },
  { value: 'percent', label: 'Percentage' },
];

export default function RoomExpenseForm() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const r = useRoom(id);
  const room = r.room;
  const isSplit = room?.type === 'split';

  const existing = useMemo(() => {
    if (!expenseId) return null;
    const fresh = queryClient.getQueryData<RoomExpenseDTO>(qk.roomExpense(id, expenseId));
    if (fresh) return fresh;
    const pages = queryClient.getQueryData<{ pages: { items: RoomExpenseDTO[] }[] }>(qk.roomExpenses(id));
    return pages?.pages.flatMap((p) => p.items).find((e) => e._id === expenseId) ?? null;
  }, [expenseId, id, queryClient]);
  const hasPaidShares = Boolean(existing?.splits.some((s) => s.paidAt));

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [date, setDate] = useState(new Date());
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [error, setError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!room || initialised) return;
    const currency = room.currency;
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time form hydration once the room has loaded
      setAmount(String(fromMinor(existing.amount, currency)));
      setNote(existing.note);
      setCategoryId(existing.categoryId);
      setDate(new Date(existing.occurredAt));
      setSplitType(existing.splitType);
      setIncluded(new Set(existing.splits.map((s) => s.userId)));
      setMethod(existing.paymentMethod ?? 'upi');
      setValues(
        Object.fromEntries(existing.splits.map((s) => [s.userId, String(existing.splitType === 'exact' ? fromMinor(s.amount, currency) : s.share)])),
      );
    } else {
      setIncluded(new Set(r.active.map((m) => m.user._id)));
    }
    setInitialised(true);
  }, [room, existing, initialised, r.active]);

  // Members who left still appear if they're part of an existing expense.
  const people = useMemo(() => {
    const ids = new Set(r.active.map((m) => m.user._id));
    existing?.splits.forEach((s) => ids.add(s.userId));
    existing?.paidBy.forEach((p) => ids.add(p.userId));
    return [...ids];
  }, [r.active, existing]);

  const currency = room?.currency ?? 'INR';
  const total = toMinor(amount || '0', currency);
  const splitOptions = existing?.splitType === 'shares' ? [...SPLIT_OPTIONS, { value: 'shares' as const, label: 'Shares' }] : SPLIT_OPTIONS;

  const splitInputs = useMemo(
    () =>
      people
        .filter((uid) => included.has(uid))
        .map((uid) => ({
          userId: uid,
          value: splitType === 'equal' ? undefined : splitType === 'exact' ? toMinor(values[uid] || '0', currency) : Number(values[uid] || 0),
        })),
    [people, included, splitType, values, currency],
  );

  const preview = useMemo(() => {
    if (!isSplit || total <= 0 || !splitInputs.length) return { splits: null, error: null as string | null };
    try {
      return { splits: computeSplits(splitType, total, splitInputs), error: null };
    } catch (err) {
      return { splits: null, error: (err as Error).message };
    }
  }, [isSplit, total, splitType, splitInputs]);

  const save = useMutation({
    mutationFn: () => {
      const details = { note: note.trim(), categoryId, occurredAt: date.toISOString(), paymentMethod: method };
      if (existing && hasPaidShares) return api.rooms.updateExpense(id, existing._id, details);
      if (total <= 0) throw new Error('Enter an amount');
      if (isSplit && !splitInputs.length) throw new Error('Pick at least one person to split with');
      if (isSplit && preview.error) throw new Error(preview.error);
      const body = {
        ...details,
        amount: total,
        splitType: isSplit ? splitType : undefined,
        splits: isSplit ? splitInputs : undefined,
      };
      return existing ? api.rooms.updateExpense(id, existing._id, body) : api.rooms.addExpense(id, body);
    },
    onSuccess: () => {
      if (!existing) trackFeature(`room_expense_${isSplit ? splitType : 'shared'}`);
      void queryClient.invalidateQueries({ queryKey: qk.room(id) });
      void queryClient.invalidateQueries({ queryKey: qk.roomSpendingAll });
      router.back();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => api.rooms.removeExpense(id, existing!._id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: qk.roomExpense(id, existing!._id) });
      void queryClient.invalidateQueries({ queryKey: qk.room(id) });
      void queryClient.invalidateQueries({ queryKey: qk.roomSpendingAll });
      router.dismissTo({ pathname: '/room/[id]', params: { id } });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (!room || !initialised) return <Loading />;

  const toggleIncluded = (uid: string) =>
    setIncluded((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  const allIncluded = people.every((uid) => included.has(uid));

  const valueSum = splitInputs.reduce((s, i) => s + (i.value ?? 0), 0);
  const remainingPct = Math.round((100 - valueSum) * 100) / 100;
  const remainingAmount = total - valueSum;
  const hasSplitValues = Object.values(values).some((v) => v !== '');
  const sumLabel = !hasSplitValues
    ? null
    : splitType === 'exact' && remainingAmount !== 0
      ? remainingAmount > 0
        ? `${formatMoney(remainingAmount, currency)} remaining`
        : `${formatMoney(-remainingAmount, currency)} over the total`
      : splitType === 'percent' && remainingPct !== 0
        ? remainingPct > 0
          ? `${remainingPct}% remaining`
          : `${-remainingPct}% over 100%`
        : null;
  const equalEach = splitType === 'equal' && preview.splits?.length ? preview.splits[0].amount : null;

  return (
    <Screen edges={['bottom']} contentStyle={{ paddingBottom: spacing.sm }}>
      <Stack.Screen options={{ title: existing ? 'Edit expense' : `Add to ${room.name}` }} />
      {hasPaidShares ? (
        <Banner tone="warning" icon="lock-outline" text="Some shares are marked paid. Undo them to change the amount or split, or to delete." />
      ) : (
        <AmountInput value={amount} onChange={setAmount} currency={currency} autoFocus={!existing} />
      )}

      <Section title="Category">
        <CategoryGrid
          categories={categories.filter((c) => c.type === 'expense')}
          value={categoryId}
          onChange={(cid) => setCategoryId((cur) => (cur === cid ? undefined : cid))}
        />
      </Section>

      <Field label="Description" value={note} onChangeText={setNote} placeholder="e.g. Dinner at Toit" maxLength={280} />

      <Section title="Paid by">
        <Card>
          <Row>
            <Avatar {...r.avatar(r.me)} size={32} />
            <AppText style={{ flex: 1 }}>You</AppText>
            {total > 0 ? <AppText muted>{formatMoney(total, currency)}</AppText> : null}
          </Row>
        </Card>
      </Section>

      <Section title="Paid with">
        <Row style={{ flexWrap: 'wrap' }}>
          {PAYMENT_METHOD_VALUES.map((m) => (
            <Chip key={m} label={METHOD_LABEL[m]} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </Row>
      </Section>

      {isSplit && !hasPaidShares ? (
        <>
          <Section
            title="Split between"
            action={
              <Pressable hitSlop={8} onPress={() => setIncluded(new Set(allIncluded ? [] : people))}>
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                  {allIncluded ? 'Clear' : 'Select all'}
                </AppText>
              </Pressable>
            }>
            <PeoplePicker people={people} selected={(uid) => included.has(uid)} onPress={toggleIncluded} avatar={r.avatar} name={r.name} multi />
          </Section>

          <Section title="Split type">
            <Segmented
              options={splitOptions}
              value={splitType}
              onChange={(t) => {
                setSplitType(t);
                setValues({});
                setError(null);
              }}
            />
            {splitInputs.length ? (
              <Card>
                {splitType === 'equal' ? (
                  <AppText muted>
                    {equalEach !== null
                      ? `${formatMoney(equalEach, currency)} each · ${splitInputs.length} ${splitInputs.length === 1 ? 'person' : 'people'}`
                      : `Split equally between ${splitInputs.length} ${splitInputs.length === 1 ? 'person' : 'people'}`}
                  </AppText>
                ) : (
                  splitInputs.map(({ userId: uid }) => {
                    const share =
                      preview.splits?.find((s) => s.userId === uid)?.amount ??
                      (splitType === 'percent' && total > 0 ? Math.round((total * Number(values[uid] || 0)) / 100) : undefined);
                    return (
                      <Row key={uid} style={{ paddingVertical: 4 }}>
                        <Avatar {...r.avatar(uid)} size={28} />
                        <AppText style={{ flex: 1 }} numberOfLines={1}>
                          {r.name(uid)}
                        </AppText>
                        <MoneyCell
                          value={values[uid] ?? ''}
                          onChange={(v) => {
                            setValues((s) => ({ ...s, [uid]: v }));
                            setError(null);
                          }}
                          suffix={splitType === 'percent' ? '%' : splitType === 'shares' ? '×' : undefined}
                        />
                        {splitType !== 'exact' ? (
                          <AppText variant="caption" muted style={{ width: 72, textAlign: 'right' }}>
                            {share !== undefined ? formatMoney(share, currency) : '—'}
                          </AppText>
                        ) : null}
                      </Row>
                    );
                  })
                )}
                {sumLabel ? (
                  <AppText variant="caption" muted>
                    {sumLabel}
                  </AppText>
                ) : null}
                {preview.error && total > 0 && hasSplitValues ? (
                  <AppText variant="caption" color={colors.danger}>
                    {preview.error}
                  </AppText>
                ) : null}
              </Card>
            ) : null}
          </Section>
        </>
      ) : null}

      <DateField label="Date" value={date} onChange={setDate} />

      <ErrorText>{error === preview.error && hasSplitValues ? null : error}</ErrorText>
      <View style={{ gap: spacing.sm }}>
        <Button title={existing ? 'Save changes' : 'Add expense'} onPress={() => save.mutate()} loading={save.isPending} />
        {existing && !hasPaidShares ? (
          <Button
            title="Delete expense"
            variant="danger"
            loading={remove.isPending}
            onPress={() =>
              Alert.alert('Delete expense?', 'Balances will be recalculated for everyone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
              ])
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

/** Horizontal row of member avatars to pick who shares the expense. */
function PeoplePicker({
  people,
  selected,
  onPress,
  avatar,
  name,
  multi,
}: {
  people: string[];
  selected: (uid: string) => boolean;
  onPress: (uid: string) => void;
  avatar: (uid: string) => { name: string; uri?: string };
  name: (uid: string) => string;
  multi?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: 2 }}>
      {people.map((uid) => {
        const on = selected(uid);
        return (
          <Pressable
            key={uid}
            onPress={() => onPress(uid)}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: on } : { selected: on }}
            accessibilityLabel={name(uid)}
            style={{ alignItems: 'center', gap: 4, width: 64 }}>
            <View>
              <View style={{ borderRadius: 999, borderWidth: 2, borderColor: on ? colors.primary : 'transparent', padding: 2, opacity: on ? 1 : 0.45 }}>
                <Avatar {...avatar(uid)} size={44} />
              </View>
              {on ? (
                <View
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: colors.primary,
                    borderWidth: 2,
                    borderColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="check" size={10} color={colors.onPrimary} />
                </View>
              ) : null}
            </View>
            <AppText variant="caption" numberOfLines={1} muted={!on} style={{ maxWidth: 64 }}>
              {name(uid)}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MoneyCell({ value, onChange, suffix }: { value: string; onChange: (v: string) => void; suffix?: string }) {
  const { colors, dark } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: dark ? colors.glassBorder : colors.textSubtle,
        backgroundColor: colors.glass,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        width: 90,
      }}>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        style={{ flex: 1, paddingVertical: 6, color: colors.text, textAlign: 'right' }}
      />
      {suffix ? <AppText muted> {suffix}</AppText> : null}
    </View>
  );
}
