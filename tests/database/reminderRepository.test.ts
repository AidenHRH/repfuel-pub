import {
  addDose,
  doneStreak,
  getCreatineSettings,
  getReminder,
  isDone,
  listReminders,
  markDone,
  setCreatineSettings,
  takenOn,
  unmarkDone,
  updateReminder,
} from '@/database/repositories/reminderRepository';

import { migratedDb } from '../helpers/seed';

const at = (iso: string) => new Date(iso);

test('creatine is ready to switch on, at 08:00 by default', async () => {
  const db = await migratedDb();
  expect(await listReminders(db)).toEqual([
    { id: 'creatine', name: 'Creatine', message: 'Time to take your creatine.', hour: 8, minute: 0, enabled: false },
  ]);
});

test('the time and on/off are saved; impossible times are refused', async () => {
  const db = await migratedDb();
  await updateReminder(db, 'creatine', { enabled: true, hour: 7, minute: 45 });
  expect(await getReminder(db, 'creatine')).toMatchObject({ enabled: true, hour: 7, minute: 45 });
  await expect(updateReminder(db, 'creatine', { hour: 24 })).rejects.toThrow(RangeError);
});

test('ticking it off is per local day, and twice is harmless', async () => {
  const db = await migratedDb();
  const morning = at('2026-10-22T07:00:00Z');
  expect(await isDone(db, 'creatine', morning)).toBe(false);
  await markDone(db, 'creatine', morning);
  await markDone(db, 'creatine', morning);
  expect(await isDone(db, 'creatine', at('2026-10-22T21:00:00Z'))).toBe(true);
  expect(await isDone(db, 'creatine', at('2026-10-23T07:00:00Z'))).toBe(false);
  await unmarkDone(db, 'creatine', morning);
  expect(await isDone(db, 'creatine', morning)).toBe(false);
});

test('the streak counts days in a row, and today only once done', async () => {
  const db = await migratedDb();
  for (const d of ['2026-10-19', '2026-10-20', '2026-10-21']) await markDone(db, 'creatine', at(`${d}T08:00:00Z`));
  expect(await doneStreak(db, 'creatine', at('2026-10-22T07:00:00Z'))).toBe(3);
  await markDone(db, 'creatine', at('2026-10-22T07:00:00Z'));
  expect(await doneStreak(db, 'creatine', at('2026-10-22T09:00:00Z'))).toBe(4);
  expect(await doneStreak(db, 'creatine', at('2026-10-25T09:00:00Z'))).toBe(0);
});

test('doses add up through the day; a day ticked before amounts existed has none', async () => {
  const db = await migratedDb();
  const morning = at('2026-10-22T07:00:00Z');
  await addDose(db, 'creatine', 5, morning);
  await addDose(db, 'creatine', 2.5, at('2026-10-22T19:00:00Z'));
  expect(await takenOn(db, 'creatine', morning)).toEqual({ done: true, grams: 7.5 });
  expect(await takenOn(db, 'creatine', at('2026-10-23T07:00:00Z'))).toEqual({ done: false, grams: null });
  await markDone(db, 'creatine', at('2026-10-20T08:00:00Z'));
  expect(await takenOn(db, 'creatine', at('2026-10-20T08:00:00Z'))).toEqual({ done: true, grams: null });
  await expect(addDose(db, 'creatine', 0, morning)).rejects.toThrow(RangeError);
});

test('creatine settings: daily amount and scoop size', async () => {
  const db = await migratedDb();
  expect(await getCreatineSettings(db)).toEqual({ dailyG: 5, scoopG: 5 });
  await setCreatineSettings(db, { dailyG: 10, scoopG: 2.5 });
  expect(await getCreatineSettings(db)).toEqual({ dailyG: 10, scoopG: 2.5 });
});
