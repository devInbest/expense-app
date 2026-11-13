import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { qk } from '@expense/api-client';
import { fromMinor, LIMITS, toMinor, type BudgetPeriod, type BudgetProgressDTO } from '@expense/shared';
import { budgetName, RolloverCard } from '@/components/BudgetParts';
import { AmountInput, CategoryPicker } from '@/components/finance';
import { Button, ErrorText, Field, Segmented, Sheet } from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

/** Which budget sheet is open: adding a new one, or editing `budget`. */
export type BudgetEditing = 'new' | BudgetProgressDTO | null;

/**
 * Add or edit a budget, in a drawer like Add bank account: it hugs its content, swipes down to close,
 * and has no close button. Give it a `key` that changes per opening so the form starts fresh.
 */
export function BudgetSheet({ editing, onClose }: { editing: BudgetEditing; onClose: () => void }) {
  const user = useUser();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { byId, categories } = useCategories();
  const existing = editing && editing !== 'new' ? editing : null;
  const currency = user.defaultCurrency;
  const [scope, setScope] = useState<'overall' | 'category'>(existing && !existing.categoryId ? 'overall' : 'category');
  const [categoryId, setCategoryId] = useState<string | undefined>(existing?.categoryId ?? undefined);
  const [period, setPeriod] = useState<BudgetPeriod>(existing?.period ?? 'monthly');
  const [amount, setAmount] = useState(existing ? String(fromMinor(existing.amount, currency)) : '');
  const [rollover, setRollover] = useState(existing?.rollover ?? false);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const minor = toMinor(amount || '0', currency);
      if (minor <= 0) throw new Error('Enter an amount');
      if (existing) return api.budgets.update(existing._id, { amount: minor, rollover, note: note.trim() });
      if (scope === 'category' && !categoryId) throw new Error('Pick a category');
      return api.budgets.create({ amount: minor, period, rollover, note: note.trim(), categoryId: scope === 'category' ? categoryId : null });
    },
    onSuccess: async () => {
      if (!existing) trackFeature('budget_create');
      await queryClient.invalidateQueries({ queryKey: qk.budgets });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  // Editing: Save stays off until something actually differs from the saved budget.
  const changed =
    !existing ||
    toMinor(amount || '0', currency) !== existing.amount ||
    rollover !== existing.rollover ||
    note.trim() !== (existing.note ?? '');

  return (
    <Sheet
      visible={editing !== null}
      showClose={false}
      dragToDismiss
      tall
      icon={existing ? 'pencil-outline' : undefined}
      title={existing ? budgetName(existing, byId) : 'New budget'}
      onClose={onClose}>
      {!existing ? (
        <>
          <Segmented
            options={[
              { value: 'category', label: 'One category' },
              { value: 'overall', label: 'All spending' },
            ]}
            value={scope}
            onChange={setScope}
          />
          <Segmented
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'weekly', label: 'Weekly' },
            ]}
            value={period}
            onChange={setPeriod}
          />
        </>
      ) : null}
      <AmountInput value={amount} onChange={setAmount} currency={currency} />
      {!existing && scope === 'category' ? (
        <CategoryPicker categories={categories.filter((c) => c.type === 'expense')} value={categoryId} onChange={setCategoryId} />
      ) : null}
      <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. Saving for a trip" maxLength={LIMITS.MAX_BUDGET_NOTE_LENGTH} multiline />
      <RolloverCard>
        <Switch
          value={rollover}
          onValueChange={setRollover}
          trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.surfaceAlt}
        />
      </RolloverCard>
      <View style={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
        <ErrorText>{error}</ErrorText>
        <Button title="Save" loading={save.isPending} disabled={!changed} onPress={() => save.mutate()} />
      </View>
    </Sheet>
  );
}
