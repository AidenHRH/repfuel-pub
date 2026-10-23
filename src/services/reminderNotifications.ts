import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import type { Db } from '@/database/Db';
import { addDose, getCreatineSettings, isDone, listReminders, markDone } from '@/database/repositories/reminderRepository';
import { localDayKey } from '@/domain/dates';
import { reminderTimes } from '@/domain/reminders';

export const REMINDER_CHANNEL = 'reminders';
export const REMINDER_CATEGORY = 'reminder';
export const TAKEN_ACTION = 'taken';
const PREFIX = 'reminder:';

export type NotificationsApi = Pick<
  typeof Notifications,
  'getAllScheduledNotificationsAsync' | 'cancelScheduledNotificationAsync' | 'scheduleNotificationAsync'
>;

/**
 * Makes the phone's scheduled reminders match the database: the next two weeks for each switched-on reminder,
 * skipping today once it's ticked off. Safe to call as often as needed (on open, after any change).
 */
export async function syncReminderNotifications(
  db: Db,
  api: NotificationsApi = Notifications,
  now: Date = new Date(),
): Promise<void> {
  const scheduled = await api.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => api.cancelScheduledNotificationAsync(n.identifier)),
  );
  for (const reminder of await listReminders(db)) {
    if (!reminder.enabled) continue;
    const takenToday = await isDone(db, reminder.id, now);
    for (const date of reminderTimes({ hour: reminder.hour, minute: reminder.minute, now, takenToday })) {
      await api.scheduleNotificationAsync({
        identifier: `${PREFIX}${reminder.id}:${localDayKey(date)}`,
        content: {
          title: reminder.name,
          body: reminder.message,
          categoryIdentifier: REMINDER_CATEGORY,
          data: { reminderId: reminder.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: REMINDER_CHANNEL },
      });
    }
  }
}

/** The notification channel, the Taken button, and showing reminders while the app is open. Run once at start. */
export async function setUpReminderNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Reminders',
    importance: AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    { identifier: TAKEN_ACTION, buttonTitle: 'Taken', options: { opensAppToForeground: true } },
  ]);
}

/** Tapping "Taken" on a reminder ticks it off for that day (creatine: the usual daily amount). Returns whether anything changed. */
export async function handleReminderResponse(
  db: Db,
  response: Notifications.NotificationResponse,
  now: Date = new Date(),
): Promise<boolean> {
  const reminderId = response.notification.request.content.data?.reminderId;
  if (response.actionIdentifier !== TAKEN_ACTION || typeof reminderId !== 'string') return false;
  if (reminderId === 'creatine') await addDose(db, reminderId, (await getCreatineSettings(db)).dailyG, now);
  else await markDone(db, reminderId, now);
  return true;
}

/** Asks Android for permission to show notifications (Android 13+ asks the owner once). */
export async function allowNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}
