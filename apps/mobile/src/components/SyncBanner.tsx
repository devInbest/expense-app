import { Banner } from './ui';
import { useSyncStatus } from '@/hooks/data';
import { retryFailed, syncNow } from '@/lib/sync';

/** Shows offline / pending / failed sync state; hidden when everything is synced. */
export function SyncBanner() {
  const status = useSyncStatus();
  if (status.failed > 0) {
    return (
      <Banner
        tone="danger"
        icon="alert-circle-outline"
        text={`${status.failed} transaction${status.failed > 1 ? 's' : ''} couldn't be saved to your account. Tap to retry.`}
        onPress={() => void retryFailed()}
      />
    );
  }
  if (status.offline) {
    return (
      <Banner
        tone="warning"
        icon="cloud-off-outline"
        text={status.pending > 0 ? `Offline · ${status.pending} change${status.pending > 1 ? 's' : ''} will sync when you're back online` : "You're offline. Changes are saved on this phone."}
        onPress={() => void syncNow()}
      />
    );
  }
  if (status.lastError) {
    return <Banner tone="warning" icon="sync-alert" text={`Sync failed: ${status.lastError}`} onPress={() => void syncNow()} />;
  }
  return null;
}
