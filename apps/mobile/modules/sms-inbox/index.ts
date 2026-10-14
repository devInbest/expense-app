import { requireOptionalNativeModule, type NativeModule } from 'expo';

export interface InboxSms {
  sender: string;
  body: string;
  /** Epoch ms. */
  receivedAt: number;
}

type SmsInboxEvents = {
  /** A message was saved to the SMS store while the app is running. */
  onSmsReceived: () => void;
};

declare class SmsInboxModule extends NativeModule<SmsInboxEvents> {
  hasPermission(): boolean;
  /** Messages received after `after` (epoch ms), oldest first, at most `limit`. */
  readAsync(after: number, limit: number): Promise<InboxSms[]>;
}

/** Null on iOS, web, and builds made before the module was added. */
export const SmsInbox = requireOptionalNativeModule<SmsInboxModule>('SmsInbox');
