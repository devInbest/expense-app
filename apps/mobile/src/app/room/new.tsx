import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { qk } from '@expense/api-client';
import { createRoomSchema, type RoomType } from '@expense/shared';
import { CurrencyField } from '@/components/CurrencyField';
import { AppText, Button, ErrorText, Field, Icon, Row, Screen, Section } from '@/components/ui';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { radius, spacing, useTheme } from '@/theme';

const TYPES: { value: RoomType; title: string; description: string; icon: string }[] = [
  {
    value: 'split',
    title: 'Split expenses',
    description: 'Trips, flatmates, dinners. Track who paid and who owes whom, then settle up.',
    icon: 'call-split',
  },
  {
    value: 'shared_budget',
    title: 'Shared budget',
    description: 'Family or couple spending from one pot. Track the total against a budget, no IOUs.',
    icon: 'piggy-bank-outline',
  },
];

const ICONS = [
  'account-group',
  'home-outline',
  'airplane',
  'silverware-fork-knife',
  'heart-outline',
  'briefcase-outline',
  'party-popper',
  'car',
  'beach',
  'island',
  'tent',
  'bus',
  'train',
  'bike',
  'cart-outline',
  'food',
  'coffee-outline',
  'beer-outline',
  'cake-variant-outline',
  'gift-outline',
  'school-outline',
  'office-building-outline',
  'hospital-box-outline',
  'dumbbell',
  'soccer',
  'gamepad-variant-outline',
  'music-note-outline',
  'movie-open-outline',
  'paw',
  'baby-carriage',
  'tools',
  'lightbulb-outline',
];
const ICON_COLUMNS = 8;

export default function NewRoom() {
  const user = useUser();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('split');
  const [currency, setCurrency] = useState(user.defaultCurrency);
  const [icon, setIcon] = useState(ICONS[0]!);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const parsed = createRoomSchema.safeParse({ name, type, currency, icon });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return api.rooms.create(parsed.data);
    },
    onSuccess: (room) => {
      trackFeature(`room_create_${room.type}`);
      void queryClient.invalidateQueries({ queryKey: qk.rooms });
      router.replace({ pathname: '/room/[id]/invite', params: { id: room._id, created: '1' } });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Screen edges={['bottom']} contentStyle={{ paddingBottom: spacing.lg }}>
      <Field label="Room name" value={name} onChangeText={setName} placeholder="e.g. Goa trip, Flat 302" maxLength={60} autoFocus />
      <Section title="Type">
        {TYPES.map((t) => {
          const selected = t.value === type;
          return (
            <Pressable
              key={t.value}
              onPress={() => setType(t.value)}
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: selected ? colors.primary : colors.glassBorder,
                backgroundColor: selected ? colors.primaryMuted : colors.glass,
                boxShadow: selected ? `0 8px 22px ${colors.glow}` : `0 6px 18px ${colors.shadow}`,
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                }}>
                <Icon name={t.icon} color={selected ? colors.onPrimary : colors.textMuted} size={24} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="subheading">{t.title}</AppText>
                <AppText variant="caption" muted>
                  {t.description}
                </AppText>
              </View>
            </Pressable>
          );
        })}
        <Row gap={spacing.xs}>
          <Icon name="information-outline" size={14} color={colors.textMuted} />
          <AppText variant="caption" muted>
            The type can’t be changed later.
          </AppText>
        </Row>
      </Section>
      <CurrencyField value={currency} onChange={setCurrency} />
      <Section title="Icon">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs / 2 }}>
          {ICONS.map((i) => (
            <View key={i} style={{ width: `${100 / ICON_COLUMNS}%`, padding: spacing.xs / 2 }}>
              <Pressable
                onPress={() => setIcon(i)}
                style={{
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: i === icon ? colors.primary : colors.glassBorder,
                  backgroundColor: i === icon ? colors.primaryMuted : colors.glass,
                }}>
                <Icon name={i} color={i === icon ? colors.primary : colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      </Section>
      <ErrorText>{error}</ErrorText>
      <Button title="Create room" icon="plus" onPress={() => create.mutate()} loading={create.isPending} />
    </Screen>
  );
}
