import { Stack } from 'expo-router';
import { StackHeader } from '@/components/StackHeader';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      initialRouteName="welcome"
      screenOptions={{
        header: (props) => <StackHeader {...props} />,
        headerTitle: '',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
