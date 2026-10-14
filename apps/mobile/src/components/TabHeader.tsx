import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { qk } from '@expense/api-client';
import { AppText, Appear, Avatar, IconButton, Row } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { setThemeMode } from '@/lib/themeMode';
import { spacing, useTheme } from '@/theme';

/** Header shared by the main tabs: profile avatar, title, extra actions, theme toggle and notifications. */
export function TabHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const user = useUser();
  const { colors, dark } = useTheme();
  const notifications = useQuery({ queryKey: qk.notifications, queryFn: () => api.notifications.list() });
  const unread = notifications.data?.unread ?? 0;
  return (
    <Appear>
      <Row gap={spacing.md}>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={6}>
          <Avatar name={user.name} uri={user.avatarUrl} size={48} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {subtitle ? (
            <AppText variant="caption" muted style={{ fontWeight: '600' }}>
              {subtitle}
            </AppText>
          ) : null}
          <AppText variant="heading" numberOfLines={1}>
            {title}
          </AppText>
        </View>
        {actions}
        <IconButton
          glass
          icon={dark ? 'white-balance-sunny' : 'weather-night'}
          label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={() => setThemeMode(dark ? 'light' : 'dark')}
        />
        <View>
          <IconButton
            glass
            icon="bell-outline"
            label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            onPress={() => router.push('/notifications')}
          />
          {unread ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                borderRadius: 9,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <AppText color={colors.onPrimary} style={{ fontSize: 10, lineHeight: 12, fontWeight: '800' }}>
                {unread > 9 ? '9+' : unread}
              </AppText>
            </View>
          ) : null}
        </View>
      </Row>
    </Appear>
  );
}
