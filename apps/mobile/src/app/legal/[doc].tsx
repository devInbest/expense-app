import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AppText, Appear, Card, Glass, Icon, Row, Screen } from '@/components/ui';
import { LEGAL_DOCS, LEGAL_UPDATED, type LegalDocId } from '@/lib/legal';
import { radius, spacing, useTheme } from '@/theme';

const ICON: Record<LegalDocId, string> = { privacy: 'shield-lock-outline', terms: 'file-document-outline' };

/** Privacy Policy (`/legal/privacy`) or Terms & Conditions (`/legal/terms`). */
export default function LegalPage() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { colors } = useTheme();
  if (doc !== 'privacy' && doc !== 'terms') return <Redirect href="/" />;
  const page = LEGAL_DOCS[doc];

  return (
    <Screen edges={['bottom']} contentStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
      <Stack.Screen options={{ title: page.title }} />

      <Appear>
        <Glass blur rounded={radius.xl} style={{ padding: spacing.lg, gap: spacing.sm, overflow: 'hidden' }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -90,
              right: -60,
              width: 220,
              height: 220,
              experimental_backgroundImage: `radial-gradient(circle at center, ${colors.primary}40 0%, ${colors.primary}00 70%)`,
            }}
          />
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: `${colors.primary}1F`,
              borderWidth: 1,
              borderColor: `${colors.primary}40`,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name={ICON[doc]} size={26} color={colors.primary} />
          </View>
          <AppText variant="heading">{page.title}</AppText>
          <AppText variant="caption" muted style={{ fontWeight: '600' }}>
            Last updated {LEGAL_UPDATED}
          </AppText>
          <AppText muted style={{ lineHeight: 22 }}>
            {page.intro}
          </AppText>
        </Glass>
      </Appear>

      {page.sections.map((section, i) => (
        <Appear key={section.heading} index={Math.min(i + 1, 6)}>
          <Card style={{ gap: spacing.sm }}>
            <Row gap={spacing.sm}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: `${colors.primary}1A`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '800' }}>
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="subheading" style={{ flex: 1 }}>
                {section.heading}
              </AppText>
            </Row>
            {section.body?.map((p) => (
              <AppText key={p} muted style={{ lineHeight: 22 }}>
                {p}
              </AppText>
            ))}
            {section.bullets?.map((b) => (
              <Row key={b} gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: colors.primary }} />
                <AppText muted style={{ flex: 1, lineHeight: 22 }}>
                  {b}
                </AppText>
              </Row>
            ))}
          </Card>
        </Appear>
      ))}
    </Screen>
  );
}
