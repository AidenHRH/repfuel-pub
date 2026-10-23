import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/database/DatabaseProvider';
import {
  addDose,
  doneStreak,
  getCreatineSettings,
  getReminder,
  setCreatineSettings,
  takenOn,
  unmarkDone,
  updateReminder,
  type Reminder,
} from '@/database/repositories/reminderRepository';
import { DEFAULT_CREATINE, topUp, type CreatineSettings } from '@/domain/creatine';
import { safely } from '@/features/safely';

import { reminderEvents } from './events';

/** A reminder with today's tick, the amount taken today (g, null when unknown) and the streak. */
export type ReminderState = Reminder & { doneToday: boolean; takenG: number | null; streak: number; creatine: CreatineSettings };

/** A reminder with today's tick and streak, and ways to change it. `null` while loading. */
export function useReminder(id: string) {
  const db = useDb();
  const [state, setState] = useState<ReminderState | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => reminderEvents.subscribe(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setVersion((v) => v + 1));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reminder = await getReminder(db, id);
      if (!reminder || cancelled) return;
      const [today, streak, creatine] = await Promise.all([takenOn(db, id), doneStreak(db, id), getCreatineSettings(db)]);
      if (!cancelled) setState({ ...reminder, doneToday: today.done, takenG: today.grams, streak, creatine });
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [db, id, version]);

  const change = useCallback(
    async (patch: Parameters<typeof updateReminder>[2]) => {
      const done = await safely('save that reminder', async () => {
        await updateReminder(db, id, patch);
        return true;
      });
      if (done) reminderEvents.emit();
    },
    [db, id],
  );

  const run = useCallback(async (what: string, action: () => Promise<void>) => {
    const done = await safely(what, async () => {
      await action();
      return true;
    });
    if (done) reminderEvents.emit();
  }, []);

  /** Taken: tops today up to the daily amount. Not taken: clears today. */
  const setDoneToday = useCallback(
    (doneToday: boolean) =>
      run('update that', async () => {
        if (!doneToday) return unmarkDone(db, id);
        const daily = state?.creatine.dailyG ?? DEFAULT_CREATINE.dailyG;
        await addDose(db, id, topUp(state?.takenG ?? null, daily) || daily);
      }),
    [db, id, run, state],
  );
  /** A dose of a chosen size, added to today. */
  const takeDose = useCallback((grams: number) => run('log that', () => addDose(db, id, grams)), [db, id, run]);
  const setCreatine = useCallback((next: CreatineSettings) => run('save that', () => setCreatineSettings(db, next)), [db, run]);

  return { reminder: state, change, setDoneToday, takeDose, setCreatine };
}
