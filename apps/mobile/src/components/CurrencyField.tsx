import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CURRENCIES, getCurrency } from '@expense/shared';
import { popup } from '@/components/popup';
import { spacing, useTheme } from '@/theme';
import { SelectModal } from './finance';
import { AppText, Icon, useFieldBoxStyle } from './ui';

export function CurrencyField({
  label = 'Currency',
  value,
  onChange,
  disabled,
  hint,
  invalid,
  /** Start locked; a pencil on the right unlocks the picker. */
  lockable = false,
  /** Controlled unlock — only one field should be `true` at a time. */
  editing,
  onRequestEdit,
}: {
  label?: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  hint?: string;
  /** Red border only, with no message under the field. */
  invalid?: boolean;
  lockable?: boolean;
  editing?: boolean;
  onRequestEdit?: () => void;
}) {
  const { colors } = useTheme();
  const box = useFieldBoxStyle();
  const [open, setOpen] = useState(false);
  const [unlockedLocal, setUnlockedLocal] = useState(!lockable);
  const controlled = lockable && editing !== undefined;
  const unlocked = lockable ? (controlled ? editing : unlockedLocal) : true;
  const locked = Boolean(disabled) || (lockable && !unlocked);
  const active = lockable && unlocked;
  const info = getCurrency(value);

  useEffect(() => {
    if (!controlled || editing) return;
    setOpen(false);
  }, [controlled, editing]);

  const unlock = () => {
    if (controlled) {
      onRequestEdit?.();
      setOpen(true);
      return;
    }
    setUnlockedLocal(true);
    setOpen(true);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs }}>
        <AppText variant="caption" muted style={{ fontWeight: '600' }}>
          {label}
        </AppText>
        {hint ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} info`}
            hitSlop={8}
            onPress={() => popup.alert(label, hint)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Icon name="information-outline" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View
        style={[
          box,
          invalid
            ? { borderColor: colors.danger, boxShadow: `0 0 0 4px ${colors.danger}26` }
            : active
              ? { borderColor: colors.primary, backgroundColor: colors.glassStrong, boxShadow: `0 0 0 4px ${colors.primaryMuted}` }
              : null,
          disabled && !lockable ? { opacity: 0.6 } : null,
        ]}>
        <Pressable
          disabled={locked}
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            opacity: pressed && !locked ? 0.75 : 1,
          })}>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
            <AppText color={colors.primary} style={{ fontWeight: '800' }}>
              {info.symbol}
            </AppText>
          </View>
          <AppText style={{ flex: 1, fontWeight: '500' }}>
            {info.name} ({info.code})
          </AppText>
          {!locked ? <Icon name="chevron-down" size={18} color={colors.textSubtle} /> : null}
          {disabled && !lockable ? <Icon name="lock-outline" size={16} color={colors.textSubtle} /> : null}
        </Pressable>
        {lockable && !unlocked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${label}`}
            hitSlop={8}
            onPress={unlock}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Icon name="pencil-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
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
