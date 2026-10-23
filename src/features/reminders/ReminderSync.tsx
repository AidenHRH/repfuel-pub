import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/database/DatabaseProvider';
import { handleReminderResponse, setUpReminderNotifications, syncReminderNotifications } from '@/services/reminderNotifications';

import { reminderEvents } from './events';

/**
 * Keeps reminder notifications scheduled (topped up whenever the app opens or a reminder changes) and handles
 * "Taken" taps, including the one that opened the app. Renders nothing.
 */
export function ReminderSync() {
  const db = useDb();

  useEffect(() => {
    let cancelled = false;
    const sync = () => void syncReminderNotifications(db).catch(() => undefined);
    const respond = async (response: Notifications.NotificationResponse) => {
      if (await handleReminderResponse(db, response).catch(() => false)) reminderEvents.emit();
    };

    (async () => {
      await setUpReminderNotifications().catch(() => undefined);
      // "Taken" tapped while the app was closed: it opened the app, so handle it now, once.
      const opening = await Notifications.getLastNotificationResponseAsync().catch(() => null);
      if (opening && !cancelled) {
        await respond(opening);
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      }
      if (!cancelled) sync();
    })();

    const responses = Notifications.addNotificationResponseReceivedListener((r) => void respond(r));
    const changes = reminderEvents.subscribe(sync);
    const appState = AppState.addEventListener('change', (state) => state === 'active' && sync());
    return () => {
      cancelled = true;
      responses.remove();
      changes();
      appState.remove();
    };
  }, [db]);

  return null;
}
