import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { FlatList, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { formatMoney, getCurrency, type CategoryDTO, type RoomSpendingItemDTO, type TransactionType } from '@expense/shared';
import { UNKNOWN_CATEGORY } from '@/hooks/data';
import { formatDate, formatTime } from '@/lib/dates';
import type { LocalTransaction } from '@/lib/transactions';
import { radius, spacing, useTheme } from '@/theme';
import { AppText, Button, CategoryIcon, Field, Icon, Row, SheetFrame, SheetHeader, useFieldBoxStyle } from './ui';

export function Money({
  amount,
  currency,
  type,
  signed,
  variant = 'subheading',
  compact,
  color: colorOverride,
}: {
  amount: number;
  currency: string;
  type?: TransactionType;
  signed?: boolean;
  variant?: 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'caption';
  compact?: boolean;
  color?: string;
}) {
  const { colors } = useTheme();
  const color =
    colorOverride ??
    (type === 'income' ? colors.income : type === 'expense' ? colors.danger : signed && amount > 0 ? colors.success : signed && amount < 0 ? colors.danger : undefined);
  const value = type === 'income' ? `+${formatMoney(amount, currency, { compact })}` : formatMoney(amount, currency, { compact, signed });
  return (
    <AppText variant={variant} color={color} style={{ fontVariant: ['tabular-nums'] }}>
      {value}
    </AppText>
  );
}

/** Large amount entry in major units; parent converts with `toMinor`. */
export function AmountInput({ value, onChange, currency, autoFocus }: { value: string; onChange: (v: string) => void; currency: string; autoFocus?: boolean }) {
  const { colors } = useTheme();
  const info = getCurrency(currency);
  const sanitize = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const [whole = '', ...rest] = cleaned.split('.');
    if (info.decimals === 0) return whole.slice(0, 10);
    const decimals = rest.join('').slice(0, info.decimals);
    return cleaned.includes('.') ? `${whole.slice(0, 10)}.${decimals}` : whole.slice(0, 10);
  };
  return (
    <Row style={{ justifyContent: 'center', paddingVertical: spacing.lg }}>
      <AppText style={{ fontSize: 36, fontWeight: '700' }} color={colors.primary}>
        {info.symbol}
      </AppText>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(sanitize(t))}
        placeholder="Enter Amount"
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        style={{ fontSize: 36, fontWeight: '800', letterSpacing: -1, color: colors.text, minWidth: 80, textAlign: 'center', padding: 0 }}
      />
    </Row>
  );
}

export function CategoryGrid({
  categories,
  value,
  onChange,
}: {
  categories: CategoryDTO[];
  value?: string;
  onChange: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {categories.map((c) => {
        const selected = c._id === value;
        return (
          <Pressable
            key={c._id}
            onPress={() => onChange(c._id)}
            style={{
              width: '23%',
              alignItems: 'center',
              gap: 4,
              paddingVertical: spacing.sm + 2,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: selected ? c.color : colors.glassBorder,
              backgroundColor: selected ? `${c.color}1A` : colors.glass,
              boxShadow: selected ? `0 6px 16px ${c.color}33` : undefined,
              transform: [{ scale: selected ? 1.04 : 1 }],
            }}>
            <CategoryIcon icon={c.icon} color={c.color} size={36} />
            <AppText variant="caption" numberOfLines={1} style={{ maxWidth: '90%' }}>
              {c.name}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DateField({ label, value, onChange, maximumDate }: { label: string; value: Date; onChange: (d: Date) => void; maximumDate?: Date }) {
  const { colors, dark } = useTheme();
  const box = useFieldBoxStyle();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption" muted style={{ fontWeight: '600', paddingHorizontal: spacing.xs }}>
        {label}
      </AppText>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [box, { opacity: pressed ? 0.75 : 1 }]}>
        <Icon name="calendar-month-outline" size={18} color={colors.primary} />
        <AppText style={{ fontWeight: '500' }}>
          {formatDate(value)} · {formatTime(value)}
        </AppText>
      </Pressable>
      {open && Platform.OS !== 'ios' ? (
        <DateTimePicker
          value={value}
          mode="date"
          maximumDate={maximumDate}
          onChange={(event, d) => {
            setOpen(false);
            if (event.type === 'set' && d) {
              const next = new Date(d);
              next.setHours(value.getHours(), value.getMinutes());
              onChange(next);
            }
          }}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <SheetFrame visible={open} onClose={() => setOpen(false)} dismissOnScrim>
          <SheetHeader title={label} onClose={() => setOpen(false)} />
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
            <ScrollView style={{ maxHeight: 460 }} bounces={false}>
              <DateTimePicker
                value={value}
                mode="datetime"
                display="inline"
                themeVariant={dark ? 'dark' : 'light'}
                accentColor={colors.primary}
                maximumDate={maximumDate}
                onChange={(_, d) => d && onChange(d)}
              />
            </ScrollView>
            <Button title="Done" onPress={() => setOpen(false)} />
          </View>
        </SheetFrame>
      ) : null}
    </View>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  left?: ReactNode;
}

/** Full-screen searchable picker. */
export function SelectModal({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  searchable,
}: {
  visible: boolean;
  title: string;
  options: SelectOption[];
  value?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
}) {
  const { colors } = useTheme();
  const { height } = useSafeAreaFrame();
  const [q, setQ] = useState('');
  const filtered = q
    ? options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    : options;
  const listHeight = Math.min(Math.max(filtered.length, 1) * 68 + spacing.md, height * 0.62);
  return (
    <SheetFrame visible={visible} onClose={onClose} dismissOnScrim>
      <SheetHeader title={title} onClose={onClose} />
      {searchable ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Field placeholder="Search" value={q} onChangeText={setQ} autoCorrect={false} />
        </View>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ height: listHeight, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.xs }}
        ListEmptyComponent={
          <AppText muted style={{ textAlign: 'center', padding: spacing.lg }}>
            No matches
          </AppText>
        }
        renderItem={({ item }) => {
          const selected = item.value === value;
          return (
            <Pressable
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: selected ? colors.primaryMuted : pressed ? colors.surfaceAlt : 'transparent',
                borderWidth: selected ? 1 : 0,
                borderColor: selected ? colors.primary : 'transparent',
              })}>
              {item.left}
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: selected ? '700' : '500' }} color={selected ? colors.primary : undefined}>
                  {item.label}
                </AppText>
                {item.description ? (
                  <AppText variant="caption" muted>
                    {item.description}
                  </AppText>
                ) : null}
              </View>
              {selected ? <Icon name="check-circle" color={colors.primary} /> : null}
            </Pressable>
          );
        }}
      />
    </SheetFrame>
  );
}

export function TransactionRow({
  tx,
  category,
  onPress,
}: {
  tx: LocalTransaction;
  category?: CategoryDTO;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const cat = category ?? UNKNOWN_CATEGORY;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, opacity: pressed ? 0.6 : 1 })}>
      <CategoryIcon icon={cat.icon} color={cat.color} size={44} square />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '600' }}>
          {cat.name}
        </AppText>
        <Row gap={4}>
          <AppText variant="caption" muted numberOfLines={1}>
            {formatTime(tx.occurredAt)}
          </AppText>
          {tx.syncError ? (
            <Icon name="alert-circle" size={14} color={colors.danger} />
          ) : tx.pending ? (
            <Icon name="cloud-upload-outline" size={14} color={colors.textMuted} />
          ) : null}
        </Row>
      </View>
      <Money amount={tx.amount} currency={tx.currency} type={tx.type} variant="body" />
    </Pressable>
  );
}

/** A room expense in the activity feed, showing my share. */
export function RoomExpenseRow({
  item,
  currency,
  category,
  onPress,
}: {
  item: RoomSpendingItemDTO;
  currency: string;
  category?: CategoryDTO;
  onPress?: () => void;
}) {
  const cat = category ?? UNKNOWN_CATEGORY;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, opacity: pressed ? 0.6 : 1 })}>
      <CategoryIcon icon={cat.icon} color={cat.color} size={44} square />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '600' }}>
          {cat.name}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {formatTime(item.occurredAt)}
        </AppText>
      </View>
      <Money amount={item.share} currency={currency} type="expense" variant="body" />
    </Pressable>
  );
}
