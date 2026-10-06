import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import { RECURRING_FREQUENCY_VALUES, formatMoney, toMinor, type RecurringFrequency, type RecurringRuleDTO } from '@expense/shared';
import { AmountInput, CategoryGrid, DateField } from '@/components/finance';
import {
  AppText,
  Button,
  Card,
  CategoryIcon,
  Chip,
  EmptyState,
  ErrorState,
  ErrorText,
  Field,
  IconButton,
  Loading,
  Row,
  Screen,
  Section,
  Sheet,
} from '@/components/ui';
import { UNKNOWN_CATEGORY, useCategories } from '@/hooks/data';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage, showError } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';

const FREQ_LABEL: Record<RecurringFrequency, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

export default function Recurring() {
  const user = useUser();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { byId } = useCategories();
  const rules = useQuery({ queryKey: qk.recurring, queryFn: api.recurring.list });
  const [creating, setCreating] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.recurring });
  const toggle = useMutation({
    mutationFn: (r: RecurringRuleDTO) => api.recurring.update(r._id, { active: !r.active }),
    onSuccess: invalidate,
    onError: (err) => showError(err),
  });
  const remove = useMutation({ mutationFn: (id: string) => api.recurring.remove(id), onSuccess: invalidate, onError: (err) => showError(err) });

  if (rules.isLoading) return <Loading />;
  if (rules.error) return <ErrorState message={errorMessage(rules.error)} onRetry={() => void rules.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen edges={[]} contentStyle={{ flexGrow: 1, paddingBottom: spacing.lg }}>
        {rules.data?.length ? (
          rules.data.map((r) => {
            const cat = byId.get(r.template.categoryId) ?? UNKNOWN_CATEGORY;
            return (
              <Card key={r._id}>
                <Row>
                  <CategoryIcon icon={cat.icon} color={cat.color} size={36} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="subheading">{r.template.note || cat.name}</AppText>
                    <AppText variant="caption" muted>
                      {formatMoney(r.template.amount, user.defaultCurrency)} · {FREQ_LABEL[r.frequency]}
                      {r.active ? ` · next ${formatDate(r.nextRunAt)}` : ' · paused'}
                    </AppText>
                  </View>
                  <Switch value={r.active} onValueChange={() => toggle.mutate(r)} trackColor={{ true: colors.primary }} />
                  <IconButton
                    icon="trash-can-outline"
                    label="Delete"
                    onPress={() =>
                      Alert.alert('Delete recurring rule?', 'Transactions already created are kept.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(r._id) },
                      ])
                    }
                  />
                </Row>
              </Card>
            );
          })
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="calendar-sync" title="No recurring transactions" />
          </View>
        )}
      </Screen>
      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button title="Add recurring" icon="plus" onPress={() => setCreating(true)} />
      </SafeAreaView>
      {creating ? <NewRuleSheet onClose={() => setCreating(false)} /> : null}
    </View>
  );
}

function NewRuleSheet({ onClose }: { onClose: () => void }) {
  const user = useUser();
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string>();
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const minor = toMinor(amount || '0', user.defaultCurrency);
      if (minor <= 0) throw new Error('Enter an amount');
      if (!categoryId) throw new Error('Pick a category');
      return api.recurring.create({
        template: { type, amount: minor, categoryId, note: note.trim() },
        frequency,
        startDate: startDate.toISOString(),
      });
    },
    onSuccess: () => {
      trackFeature('recurring_create');
      void queryClient.invalidateQueries({ queryKey: qk.recurring });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Sheet visible title="New recurring" onClose={onClose}>
      <Row>
        <Chip label="Expense" selected={type === 'expense'} onPress={() => setType('expense')} />
        <Chip label="Income" selected={type === 'income'} onPress={() => setType('income')} />
      </Row>
      <AmountInput value={amount} onChange={setAmount} currency={user.defaultCurrency} />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. Netflix" />
      <Section title="Repeats">
        <Row style={{ flexWrap: 'wrap' }}>
          {RECURRING_FREQUENCY_VALUES.map((f) => (
            <Chip key={f} label={FREQ_LABEL[f]} selected={frequency === f} onPress={() => setFrequency(f)} />
          ))}
        </Row>
      </Section>
      <DateField label="Starts" value={startDate} onChange={setStartDate} />
      <Section title="Category">
        <CategoryGrid categories={categories.filter((c) => c.type === type)} value={categoryId} onChange={setCategoryId} />
      </Section>
      <ErrorText>{error}</ErrorText>
      <Button title="Create" onPress={() => create.mutate()} loading={create.isPending} />
    </Sheet>
  );
}
