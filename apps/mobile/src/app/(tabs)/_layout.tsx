import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Icon } from '@/components/ui';
import { useTheme } from '@/theme';

const tab = (title: string, icon: string) => ({
  title,
  tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <Icon name={icon} color={color as string} size={size} />,
});

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}>
      <Tabs.Screen name="index" options={tab('Home', 'home-variant-outline')} />
      <Tabs.Screen name="transactions" options={tab('Activity', 'format-list-bulleted')} />
      <Tabs.Screen name="rooms" options={tab('Rooms', 'account-group-outline')} />
      <Tabs.Screen name="insights" options={tab('Insights', 'chart-donut')} />
      <Tabs.Screen name="profile" options={tab('Profile', 'account-circle-outline')} />
    </Tabs>
  );
}
