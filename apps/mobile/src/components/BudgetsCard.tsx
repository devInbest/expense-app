import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { formatMoney, type BudgetProgressDTO, type CategoryDTO } from '@expense/shared';
import { AppText, Card, CategoryIcon, Icon, ProgressBar, Row, SectionHeader } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

const resetsOn = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Home screen budget summary: overall monthly budget plus the categories closest to their limit. */
export function BudgetsCard({
  overall,
  categories,
  categoryById,
  currency,
}: {
  overall?: BudgetProgressDTO;
  categories: BudgetProgressDTO[];
  categoryById: Map<string, CategoryDTO>;
  currency: string;
}) {
  const { colors } = useTheme();
  const toneFor = (percent: number) => (percent >= 100 ? colors.danger : percent >= 80 ? colors.warning : colors.primary);
  const open = () => router.push('/budgets');

  if (!overall && !categories.length) {
    return (
      <Card onPress={open}>
        <Row gap={spacing.md}>
          <CategoryIcon icon="target" color={colors.primary} size={44} square />
          <AppText style={{ flex: 1, fontWeight: '700' }}>Set a monthly budget</AppText>
          <Icon name="chevron-right" size={20} color={colors.textSubtle} />
        </Row>
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader icon="target" title="Budgets" actionLabel="Manage" onAction={open} />

      <Card style={{ gap: spacing.lg }}>
        {overall ? (
          <Pressable onPress={open} style={{ gap: spacing.sm }}>
            <Row>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" muted>
                  {overall.remaining >= 0 ? 'Left to spend' : 'Over budget'}
                </AppText>
                <AppText variant="title" color={overall.remaining < 0 ? colors.danger : undefined} style={{ fontVariant: ['tabular-nums'] }}>
                  {formatMoney(Math.abs(overall.remaining), currency)}
                </AppText>
              </View>
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  backgroundColor: `${toneFor(overall.percent)}1A`,
                }}>
                <AppText variant="caption" color={toneFor(overall.percent)} style={{ fontWeight: '700' }}>
                  {overall.percent}%
                </AppText>
              </View>
            </Row>
            <ProgressBar percent={overall.percent} height={10} />
            <Row>
              <AppText variant="caption" muted style={{ flex: 1 }}>
                {formatMoney(overall.spent, currency)} of {formatMoney(overall.amount, currency)}
              </AppText>
              <AppText variant="caption" muted>
                Resets {resetsOn(overall.periodEnd)}
              </AppText>
            </Row>
          </Pressable>
        ) : null}

        {overall && categories.length ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}

        {categories.map((b) => {
          const cat = b.categoryId ? categoryById.get(b.categoryId) : undefined;
          return (
            <Pressable key={b._id} onPress={open}>
              <Row gap={spacing.md}>
                <CategoryIcon icon={cat?.icon ?? 'shape-outline'} color={cat?.color ?? colors.textMuted} size={32} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Row>
                    <AppText numberOfLines={1} style={{ flex: 1 }}>
                      {cat?.name ?? 'Category'}
                    </AppText>
                    <AppText variant="caption" muted>
                      {formatMoney(b.spent, currency, { compact: true })} / {formatMoney(b.amount, currency, { compact: true })}
                    </AppText>
                  </Row>
                  <ProgressBar percent={b.percent} height={6} color={b.percent >= 80 ? toneFor(b.percent) : cat?.color} />
                </View>
              </Row>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}
