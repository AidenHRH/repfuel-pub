import { newRecords } from '@/domain/records';
import type { MuscleGroup } from '@/domain/exercises';
import type { SessionBreaks } from '@/domain/sessions';
import { itemAt, type FeedItem } from '@/domain/training';

import type { Db } from '../Db';

import { recentClasses } from './classRepository';
import { getExercise } from './exerciseRepository';
import { recentLifts, setsForExercise } from './liftRepository';
import { getSetting, setSetting } from './settingsRepository';

/** Lifts and classes together, newest first. A lift is a PR when it beat everything logged before it. */
export async function trainingFeed(db: Db, limit = 60): Promise<FeedItem[]> {
  const [lifts, classes] = await Promise.all([recentLifts(db, limit), recentClasses(db, limit)]);
  const history = new Map<string, Awaited<ReturnType<typeof setsForExercise>>>();
  const muscles = new Map<string, MuscleGroup | undefined>();
  const items: FeedItem[] = [];
  for (const lift of lifts) {
    if (!history.has(lift.exerciseId)) history.set(lift.exerciseId, await setsForExercise(db, lift.exerciseId));
    const all = history.get(lift.exerciseId)!;
    const before = all.filter((s) => s.at < lift.at);
    const own = all.filter((s) => s.workoutId === lift.workoutId);
    if (!muscles.has(lift.exerciseId)) muscles.set(lift.exerciseId, (await getExercise(db, lift.exerciseId))?.muscleGroup);
    items.push({ kind: 'lift', lift: { ...lift, muscleGroup: muscles.get(lift.exerciseId) }, isPr: newRecords(before, own).length > 0 });
  }
  for (const session of classes) items.push({ kind: 'class', session });
  return items.sort((a, b) => itemAt(b).localeCompare(itemAt(a))).slice(0, limit);
}

/** The owner's session corrections (a lift that starts a new session, or joins the previous one). */
export async function sessionBreaks(db: Db): Promise<SessionBreaks> {
  return getSetting<SessionBreaks>(db, 'sessionBreaks', {});
}

export async function setSessionBreak(db: Db, workoutId: string, value: 'split' | 'join' | null): Promise<void> {
  const all = await sessionBreaks(db);
  if (value === null) delete all[workoutId];
  else all[workoutId] = value;
  await setSetting(db, 'sessionBreaks', all);
}
