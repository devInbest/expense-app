import type { NativeStackHeaderProps } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, IconButton, Row } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/** Compact header for stack screens: back arrow, title and the screen's `headerRight`. */
export function StackHeader({ navigation, options, route, back }: NativeStackHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // iOS modals are sheets that start below the status bar.
  const sheet = Platform.OS === 'ios' && (options.presentation === 'modal' || options.presentation === 'formSheet');
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name);
  return (
    <Row
      gap={spacing.sm}
      style={{
        paddingTop: (sheet ? 0 : insets.top) + spacing.md,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.background,
      }}>
      {back ? <IconButton icon="arrow-left" label="Back" onPress={() => navigation.goBack()} /> : null}
      <AppText variant="subheading" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </AppText>
      {options.headerRight?.({ tintColor: colors.text, canGoBack: navigation.canGoBack() })}
    </Row>
  );
}
