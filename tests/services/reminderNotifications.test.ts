import type { NotificationResponse, NotificationRequestInput } from 'expo-notifications';

import { isDone, markDone, setCreatineSettings, takenOn, updateReminder } from '@/database/repositories/reminderRepository';
import { handleReminderResponse, syncReminderNotifications, type NotificationsApi } from '@/services/reminderNotifications';

import { migratedDb } from '../helpers/seed';

function fakeApi(existing: string[] = []) {
  const scheduled = new Map<string, NotificationRequestInput>(existing.map((id) => [id, {} as NotificationRequestInput]));
  const api: NotificationsApi = {
    getAllScheduledNotificationsAsync: async () => [...scheduled.keys()].map((identifier) => ({ identifier }) as never),
    cancelScheduledNotificationAsync: async (id: string) => void scheduled.delete(id),
    scheduleNotificationAsync: async (req: NotificationRequestInput) => {
      scheduled.set(req.identifier!, req);
      return req.identifier!;
    },
  };
  return { api, scheduled };
}

const now = new Date('2026-10-22T06:00:00Z'); // 07:00 London

test('a switched-on reminder schedules the next two weeks, with a Taken button', async () => {
  const db = await migratedDb();
  await updateReminder(db, 'creatine', { enabled: true, hour: 8, minute: 0 });
  const { api, scheduled } = fakeApi();
  await syncReminderNotifications(db, api, now);
  expect(scheduled.size).toBe(14);
  const first = scheduled.get('reminder:creatine:2026-10-22')!;
  expect(first.content).toMatchObject({ title: 'Creatine', body: 'Time to take your creatine.', categoryIdentifier: 'reminder' });
  expect((first.trigger as { date: Date }).date.toISOString()).toBe('2026-10-22T07:00:00.000Z');
});

test('ticked off today: today’s reminder is dropped; switched off: all are cancelled; others are left alone', async () => {
  const db = await migratedDb();
  await updateReminder(db, 'creatine', { enabled: true });
  const { api, scheduled } = fakeApi(['something-else']);
  await syncReminderNotifications(db, api, now);
  await markDone(db, 'creatine', now);
  await syncReminderNotifications(db, api, now);
  expect(scheduled.has('reminder:creatine:2026-10-22')).toBe(false);
  expect(scheduled.has('reminder:creatine:2026-10-23')).toBe(true);

  await updateReminder(db, 'creatine', { enabled: false });
  await syncReminderNotifications(db, api, now);
  expect([...scheduled.keys()]).toEqual(['something-else']);
});

test('tapping Taken on the notification ticks it off; just opening it does not', async () => {
  const db = await migratedDb();
  const response = (actionIdentifier: string) =>
    ({
      actionIdentifier,
      notification: { request: { content: { data: { reminderId: 'creatine' } } } },
    }) as unknown as NotificationResponse;
  expect(await handleReminderResponse(db, response('expo.modules.notifications.actions.DEFAULT'), now)).toBe(false);
  expect(await isDone(db, 'creatine', now)).toBe(false);
  expect(await handleReminderResponse(db, response('taken'), now)).toBe(true);
  expect(await isDone(db, 'creatine', now)).toBe(true);
});

test('Taken on the notification logs the usual daily amount', async () => {
  const now = new Date('2026-10-22T07:00:00Z');
  const db = await migratedDb();
  await setCreatineSettings(db, { dailyG: 10, scoopG: 5 });
  const response = { actionIdentifier: 'taken', notification: { request: { content: { data: { reminderId: 'creatine' } } } } };
  expect(await handleReminderResponse(db, response as unknown as NotificationResponse, now)).toBe(true);
  expect(await takenOn(db, 'creatine', now)).toEqual({ done: true, grams: 10 });
});
