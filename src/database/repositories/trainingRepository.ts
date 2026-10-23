import { newRecords } from '@/domain/records';
import { itemAt, type FeedItem } from '@/domain/training';

import type { Db } from '../Db';

import { recentClasses } from './classRepository';
import { recentLifts, setsForExercise } from './liftRepository';

/** Lifts and classes together, newest first. A lift is a PR when it beat everything logged before it. */
export async function trainingFeed(db: Db, limit = 60): Promise<FeedItem[]> {
  const [lifts, classes] = await Promise.all([recentLifts(db, limit), recentClasses(db, limit)]);
  const history = new Map<string, Awaited<ReturnType<typeof setsForExercise>>>();
  const items: FeedItem[] = [];
  for (const lift of lifts) {
    if (!history.has(lift.exerciseId)) history.set(lift.exerciseId, await setsForExercise(db, lift.exerciseId));
    const all = history.get(lift.exerciseId)!;
    const before = all.filter((s) => s.at < lift.at);
    const own = all.filter((s) => s.workoutId === lift.workoutId);
    items.push({ kind: 'lift', lift, isPr: newRecords(before, own).length > 0 });
  }
  for (const session of classes) items.push({ kind: 'class', session });
  return items.sort((a, b) => itemAt(b).localeCompare(itemAt(a))).slice(0, limit);
}
