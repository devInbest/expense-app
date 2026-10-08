import { View } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { AppText, Appear, Glass, Icon } from './ui';

export function AuthHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  const { colors } = useTheme();
  return (
    <Appear style={{ gap: spacing.md }}>
      <Glass rounded={22} style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} color={colors.primary} />
      </Glass>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">{title}</AppText>
        <AppText muted style={{ lineHeight: 21 }}>
          {subtitle}
        </AppText>
      </View>
    </Appear>
  );
}
