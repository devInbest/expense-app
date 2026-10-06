import { router } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon="map-marker-question-outline"
        title="Page not found"
        message="This link may be broken or out of date."
        action={<Button title="Go home" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
