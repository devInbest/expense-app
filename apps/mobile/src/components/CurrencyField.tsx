import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CURRENCIES, getCurrency } from '@expense/shared';
import { radius, spacing, useTheme } from '@/theme';
import { SelectModal } from './finance';
import { AppText, Icon } from './ui';

export function CurrencyField({
  label = 'Currency',
  value,
  onChange,
  disabled,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const info = getCurrency(value);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          opacity: disabled ? 0.6 : 1,
        }}>
        <AppText style={{ width: 28 }}>{info.symbol}</AppText>
        <AppText style={{ flex: 1 }}>
          {info.name} ({info.code})
        </AppText>
        {!disabled ? <Icon name="chevron-down" size={18} color={colors.textMuted} /> : <Icon name="lock-outline" size={16} color={colors.textMuted} />}
      </Pressable>
      {hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
      <SelectModal
        visible={open}
        title="Choose currency"
        searchable
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
        options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol}  ${c.name}`, description: c.code }))}
      />
    </View>
  );
}
