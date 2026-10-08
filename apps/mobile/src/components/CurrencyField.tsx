import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CURRENCIES, getCurrency } from '@expense/shared';
import { spacing, useTheme } from '@/theme';
import { SelectModal } from './finance';
import { AppText, Icon, useFieldBoxStyle } from './ui';

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
  const box = useFieldBoxStyle();
  const [open, setOpen] = useState(false);
  const info = getCurrency(value);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption" muted style={{ fontWeight: '600', paddingHorizontal: spacing.xs }}>
        {label}
      </AppText>
      <Pressable disabled={disabled} onPress={() => setOpen(true)} style={({ pressed }) => [box, { opacity: disabled ? 0.6 : pressed ? 0.75 : 1 }]}>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
          <AppText color={colors.primary} style={{ fontWeight: '800' }}>
            {info.symbol}
          </AppText>
        </View>
        <AppText style={{ flex: 1, fontWeight: '500' }}>
          {info.name} ({info.code})
        </AppText>
        {!disabled ? <Icon name="chevron-down" size={18} color={colors.textSubtle} /> : <Icon name="lock-outline" size={16} color={colors.textSubtle} />}
      </Pressable>
      {hint ? (
        <AppText variant="caption" muted style={{ paddingHorizontal: spacing.xs }}>
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
