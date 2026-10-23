import { useEffect } from 'react';
import { AppState } from 'react-native';

import { backupNow, getCloudStatus } from '@/database/cloudBackup';
import { useDb } from '@/database/DatabaseProvider';
import { getCloud } from '@/services/cloud';

import { cloudEvents } from './events';

/** At most one automatic try every 10 minutes. */
const QUIET_MS = 10 * 60_000;

/** Backs up quietly when the app opens or comes back to the front, if signed in and something changed. */
export function CloudSync() {
  const db = useDb();
  useEffect(() => {
    let running = false;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const status = await getCloudStatus(db);
        if (status.lastAttemptAt && Date.now() - Date.parse(status.lastAttemptAt) < QUIET_MS) return;
        const cloud = getCloud();
        const user = await cloud.auth.currentUser();
        if (!user) return;
        await backupNow(db, cloud, user.id).catch(() => undefined);
        cloudEvents.emit();
      } catch {
        // Never in the way of logging.
      } finally {
        running = false;
      }
    };
    void sync();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && void sync());
    return () => sub.remove();
  }, [db]);
  return null;
}
