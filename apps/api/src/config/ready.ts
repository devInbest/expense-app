import { bootstrap } from '../seed/bootstrap';
import { connectDatabase } from './database';

let ready: Promise<void> | undefined;

/** Opens MongoDB and seeds the superadmin once per process. Later calls wait for the same attempt. */
export const ensureReady = (): Promise<void> => {
  if (!ready) {
    ready = (async () => {
      await connectDatabase();
      await bootstrap();
    })().catch((error) => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
};
