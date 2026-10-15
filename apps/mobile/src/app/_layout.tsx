import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Linking, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import { compareVersions } from '@expense/shared';
import { BrandSplash } from '@/components/BrandSplash';
import { StackHeader } from '@/components/StackHeader';
import { AppText, Backdrop, Button, EmptyState } from '@/components/ui';
import { useAppLifecycle, useBankSmsImport, useNotificationRouting, useScreenTracking } from '@/hooks/lifecycle';
import { api } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { queryClient } from '@/lib/queryClient';
import { loadThemeMode } from '@/lib/themeMode';
import { spacing, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
void loadThemeMode();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { status, user, retry } = useAuth();
  const signedIn = status === 'signedIn' && !!user;
  const onboarded = signedIn && user.onboarded;

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useAppLifecycle(signedIn);
  useScreenTracking(signedIn);
  useNotificationRouting(onboarded);
  useBankSmsImport(onboarded);

  return (
    <View style={{ flex: 1 }}>
      {status === 'unreachable' ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Backdrop />
          <EmptyState
            icon="cloud-off-outline"
            title="Can't reach the server"
            message="Check your connection and try again."
            action={<Button title="Retry" onPress={retry} />}
          />
        </View>
      ) : (
        <AppNavigator signedIn={signedIn} onboarded={onboarded} />
      )}
      <BrandSplash ready={status !== 'loading'} />
    </View>
  );
}

function AppNavigator({ signedIn, onboarded }: { signedIn: boolean; onboarded: boolean }) {
  const { dark, colors } = useTheme();
  const navTheme = dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, primary: colors.primary, background: colors.background, card: colors.background, text: colors.text, border: colors.border },
      }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AppGate>
        <Stack
          screenOptions={{
            header: (props) => <StackHeader {...props} />,
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Protected guard={signedIn && !onboarded}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ title: 'Profile' }} />
            <Stack.Screen name="upi" options={{ title: 'UPI ID' }} />
            <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', title: 'Transaction' }} />
            <Stack.Screen name="transaction/view/[id]" options={{ title: 'Transaction' }} />
            <Stack.Screen name="bin" options={{ title: 'Bin' }} />
            <Stack.Screen name="budgets" options={{ title: 'Budgets' }} />
            <Stack.Screen name="categories" options={{ title: 'Categories' }} />
            <Stack.Screen name="recurring" options={{ title: 'Recurring' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="notification/[id]" options={{ title: 'Notification' }} />
            <Stack.Screen name="invites" options={{ title: 'Room invites' }} />
            <Stack.Screen name="sessions" options={{ title: 'Devices' }} />
            <Stack.Screen name="account" options={{ title: 'Account' }} />
            <Stack.Screen name="export" options={{ title: 'Report' }} />
            <Stack.Screen name="bank/[id]" options={{ title: '' }} />
            <Stack.Screen name="room/new" options={{ presentation: 'modal', title: 'New room' }} />
            <Stack.Screen name="room/[id]/index" options={{ title: '' }} />
            <Stack.Screen name="room/[id]/expense" options={{ presentation: 'modal', title: 'Expense' }} />
            <Stack.Screen name="room/[id]/expense-detail" options={{ title: 'Expense' }} />
            <Stack.Screen name="room/[id]/members" options={{ title: 'Members' }} />
            <Stack.Screen name="room/[id]/invite" options={{ presentation: 'modal', title: 'Invite people' }} />
            <Stack.Screen name="room/[id]/settings" options={{ title: 'Room settings' }} />
          </Stack.Protected>

          <Stack.Screen name="join/[code]" options={{ title: 'Join room' }} />
          <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
        </Stack>
      </AppGate>
    </ThemeProvider>
  );
}

/** Blocks the app during maintenance or when this build is below the minimum supported version. */
function AppGate({ children }: { children: ReactNode }) {
  const { data } = useQuery({ queryKey: qk.appSettings, queryFn: api.appSettings, staleTime: 5 * 60_000 });

  const outdated = data && compareVersions(config.appVersion, data.minAppVersion) < 0;
  if (!data || (!data.maintenanceMode && !outdated)) return <>{children}</>;

  const storeUrl = Platform.OS === 'ios' ? 'itms-apps://apps.apple.com' : 'market://details?id=com.expenseapp';
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
      <Backdrop />
      {outdated ? (
        <EmptyState
          icon="cellphone-arrow-down"
          title="Update required"
          message={`This version (${config.appVersion}) is no longer supported. Please update to continue.`}
          action={<Button title="Update" onPress={() => void Linking.openURL(storeUrl)} />}
        />
      ) : (
        <EmptyState icon="wrench-outline" title="Under maintenance" message={data.maintenanceMessage || "We'll be back shortly."} />
      )}
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        v{config.appVersion}
      </AppText>
    </View>
  );
}
