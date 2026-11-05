import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/** Public entry for "/": the other screens are guarded by auth state, so send each user to the one they can open. */
export default function Index() {
  const { status, user } = useAuth();

  if (status === 'loading') return null;
  if (status !== 'signedIn' || !user) return <Redirect href="/welcome" />;
  if (!user.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
