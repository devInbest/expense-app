import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { GlassTabBar } from '@/components/GlassTabBar';
import { Icon } from '@/components/ui';

const tab = (title: string, icon: string) => ({
  title,
  tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <Icon name={icon} color={color as string} size={size} />,
});

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={tab('Home', 'home-variant')} />
      <Tabs.Screen name="transactions" options={tab('Activity', 'swap-vertical-bold')} />
      <Tabs.Screen name="rooms" options={tab('Rooms', 'account-group')} />
      <Tabs.Screen name="insights" options={tab('Insights', 'chart-donut')} />
      <Tabs.Screen name="profile" options={tab('Profile', 'account-circle')} />
    </Tabs>
  );
}
