import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { qk } from '@expense/api-client';
import { createCategorySchema, type CategoryDTO, type TransactionType } from '@expense/shared';
import { Button, Card, CategoryIcon, ErrorText, Field, Icon, ListItem, Loading, Screen, Section, Segmented, Sheet } from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { api, errorMessage, showError } from '@/lib/api';
import { syncNow } from '@/lib/sync';
import { radius, spacing, useTheme } from '@/theme';

const ICONS = [
  'tag-outline', 'food', 'coffee', 'cart-outline', 'car', 'bus', 'home-outline', 'flash-outline', 'cellphone',
  'medical-bag', 'school-outline', 'gift-outline', 'airplane', 'gamepad-variant-outline', 'paw', 'baby-carriage',
  'dumbbell', 'tshirt-crew-outline', 'hammer-wrench', 'cash-multiple', 'briefcase-outline', 'piggy-bank-outline',
];
const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#0EA5E9', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'];

export default function Categories() {
  const queryClient = useQueryClient();
  const { categories, isLoading } = useCategories();
  const [type, setType] = useState<TransactionType>('expense');
  const [creating, setCreating] = useState(false);

  const remove = useMutation({
    mutationFn: (c: CategoryDTO) => api.categories.remove(c._id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.categories });
      // Its transactions moved to Uncategorized on the server; pull them.
      void syncNow();
    },
    onError: (err) => showError(err),
  });

  const confirmRemove = (c: CategoryDTO) =>
    Alert.alert(`Delete "${c.name}"?`, 'Existing transactions will move to Uncategorized.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(c) },
    ]);

  if (isLoading) return <Loading />;
  const list = categories.filter((c) => c.type === type);
  const custom = list.filter((c) => c.ownerType === 'user');
  const system = list.filter((c) => c.ownerType === 'system');

  return (
    <Screen edges={[]}>
      <Segmented
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
        value={type}
        onChange={setType}
      />
      <Section title="Your categories">
        <Card>
          {custom.length ? (
            custom.map((c) => (
              <ListItem
                key={c._id}
                title={c.name}
                left={<CategoryIcon icon={c.icon} color={c.color} size={32} />}
                right={<Icon name="trash-can-outline" size={20} />}
                onPress={() => confirmRemove(c)}
              />
            ))
          ) : (
            <ListItem title="No custom categories yet" subtitle="Add your own to organise spending your way." />
          )}
        </Card>
      </Section>
      <Button title="Add category" icon="plus" onPress={() => setCreating(true)} />
      <Section title="Built-in">
        <Card>
          {system.map((c) => (
            <ListItem key={c._id} title={c.name} left={<CategoryIcon icon={c.icon} color={c.color} size={32} />} />
          ))}
        </Card>
      </Section>
      {creating ? <NewCategorySheet type={type} onClose={() => setCreating(false)} /> : null}
    </Screen>
  );
}

function NewCategorySheet({ type, onClose }: { type: TransactionType; onClose: () => void }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]!);
  const [color, setColor] = useState(COLORS[6]!);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const parsed = createCategorySchema.safeParse({ name, icon, color, type });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return api.categories.create(parsed.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.categories });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Sheet visible title="New category" onClose={onClose}>
      <View style={{ alignItems: 'center' }}>
        <CategoryIcon icon={icon} color={color} size={64} />
      </View>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Pets" maxLength={40} autoFocus />
      <Section title="Icon">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              style={{ padding: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: i === icon ? color : colors.border }}>
              <Icon name={i} color={i === icon ? color : colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title="Colour">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`Colour ${c}`}
              onPress={() => setColor(c)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: c === color ? colors.text : 'transparent' }}
            />
          ))}
        </View>
      </Section>
      <ErrorText>{error}</ErrorText>
      <Button title="Create" onPress={() => create.mutate()} loading={create.isPending} />
    </Sheet>
  );
}
