import { Stack } from 'expo-router';
import { StackHeader } from '@/components/StackHeader';
import { useTheme } from '@/theme';

export const unstable_settings = {
  anchor: 'welcome',
};

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        header: (props) => <StackHeader {...props} />,
        headerTitle: '',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      {/* Phone login temporarily disabled — Google only for now.
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
      */}
    </Stack>
  );
}
