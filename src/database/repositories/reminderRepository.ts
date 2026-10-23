import { DEFAULT_CREATINE, type CreatineSettings } from '@/domain/creatine';
import { localDayKey } from '@/domain/dates';
import type { DailyTime } from '@/domain/reminders';

import type { Db } from '../Db';
import { nowIso } from '../ids';

import { getSetting, setSetting } from './settingsRepository';

export type Reminder = DailyTime & { id: string; name: string; message: string; enabled: boolean };

type Row = { id: string; name: string; message: string; hour: number; minute: number; enabled: number };

const toReminder = (r: Row): Reminder => ({
  id: r.id,
  name: r.name,
  message: r.message,
  hour: r.hour,
  minute: r.minute,
  enabled: r.enabled === 1,
});

export async function listReminders(db: Db): Promise<Reminder[]> {
  return (await db.getAll<Row>('SELECT * FROM reminder ORDER BY hour, minute, name')).map(toReminder);
}

export async function getReminder(db: Db, id: string): Promise<Reminder | null> {
  const row = await db.getFirst<Row>('SELECT * FROM reminder WHERE id = ?', [id]);
  return row ? toReminder(row) : null;
}

export async function updateReminder(db: Db, id: string, patch: Partial<DailyTime & { enabled: boolean }>): Promise<Reminder> {
  const current = await getReminder(db, id);
  if (!current) throw new Error('Reminder not found');
  const next = { ...current, ...patch };
  if (
    !Number.isInteger(next.hour) ||
    next.hour < 0 ||
    next.hour > 23 ||
    !Number.isInteger(next.minute) ||
    next.minute < 0 ||
    next.minute > 59
  ) {
    throw new RangeError('Pick a time of day');
  }
  await db.run('UPDATE reminder SET hour = ?, minute = ?, enabled = ? WHERE id = ?', [
    next.hour,
    next.minute,
    next.enabled ? 1 : 0,
    id,
  ]);
  return next;
}

/** Ticks a reminder off for the local day of `at`. Ticking twice is harmless. */
export async function markDone(db: Db, id: string, at: Date = new Date()): Promise<void> {
  await db.run('INSERT OR IGNORE INTO reminder_done (reminder_id, local_day, done_at) VALUES (?, ?, ?)', [
    id,
    localDayKey(at),
    nowIso(),
  ]);
}

export async function unmarkDone(db: Db, id: string, at: Date = new Date()): Promise<void> {
  await db.run('DELETE FROM reminder_done WHERE reminder_id = ? AND local_day = ?', [id, localDayKey(at)]);
}

export async function isDone(db: Db, id: string, at: Date = new Date()): Promise<boolean> {
  return (
    (await db.getFirst('SELECT 1 AS done FROM reminder_done WHERE reminder_id = ? AND local_day = ?', [id, localDayKey(at)])) !==
    null
  );
}

/** Days in a row it's been ticked off, counting today only once it's done (so a streak survives until bedtime). */
export async function doneStreak(db: Db, id: string, at: Date = new Date()): Promise<number> {
  const days = new Set(
    (await db.getAll<{ local_day: string }>('SELECT local_day FROM reminder_done WHERE reminder_id = ?', [id])).map(
      (r) => r.local_day,
    ),
  );
  let streak = 0;
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  if (!days.has(localDayKey(day))) day.setDate(day.getDate() - 1);
  while (days.has(localDayKey(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

/** Adds a dose (in g) to the day of `at`, ticking it off. */
export async function addDose(db: Db, id: string, grams: number, at: Date = new Date()): Promise<void> {
  if (!Number.isFinite(grams) || grams <= 0) throw new RangeError('Choose how much');
  await db.run(
    `INSERT INTO reminder_done (reminder_id, local_day, done_at, amount_g) VALUES (?, ?, ?, ?)
     ON CONFLICT (reminder_id, local_day) DO UPDATE SET amount_g = coalesce(amount_g, 0) + excluded.amount_g, done_at = excluded.done_at`,
    [id, localDayKey(at), nowIso(), grams],
  );
}

/** Whether the day of `at` is ticked off, and how much was taken (null when unknown). */
export async function takenOn(db: Db, id: string, at: Date = new Date()): Promise<{ done: boolean; grams: number | null }> {
  const row = await db.getFirst<{ amount_g: number | null }>(
    'SELECT amount_g FROM reminder_done WHERE reminder_id = ? AND local_day = ?',
    [id, localDayKey(at)],
  );
  return row ? { done: true, grams: row.amount_g } : { done: false, grams: null };
}

export async function getCreatineSettings(db: Db): Promise<CreatineSettings> {
  return { ...DEFAULT_CREATINE, ...(await getSetting<Partial<CreatineSettings>>(db, 'creatine', {})) };
}

export async function setCreatineSettings(db: Db, settings: CreatineSettings): Promise<void> {
  await setSetting(db, 'creatine', settings);
}
