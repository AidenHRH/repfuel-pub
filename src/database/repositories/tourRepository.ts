import { DEFAULT_TOUR_STATE, type Feature, type TipFacts, type TourState, type Usage } from '@/domain/tips';

import type { Db } from '../Db';

import { getSetting, setSetting } from './settingsRepository';

export async function getTourState(db: Db): Promise<TourState> {
  return { ...DEFAULT_TOUR_STATE, ...(await getSetting<Partial<TourState>>(db, 'tour', {})) };
}

export async function saveTourState(db: Db, patch: Partial<TourState>): Promise<TourState> {
  const next = { ...(await getTourState(db)), ...patch };
  await setSetting(db, 'tour', next);
  return next;
}

/** Notes that a feature was just used, for tips about features not used lately. */
export async function recordUse(db: Db, feature: Feature, now: Date = new Date()): Promise<void> {
  const usage = await getSetting<Usage>(db, 'usage', {});
  await setSetting(db, 'usage', { ...usage, [feature]: now.toISOString() });
}

const count = async (db: Db, sql: string) => (await db.getFirst<{ n: number }>(sql))?.n ?? 0;

export async function tipFacts(db: Db): Promise<TipFacts> {
  const [usage, snackTiles, classes, effortSets, plans, creatine, first] = await Promise.all([
    getSetting<Usage>(db, 'usage', {}),
    count(db, 'SELECT count(*) AS n FROM food_product WHERE in_snacks_row = 1 AND deleted_at IS NULL'),
    count(db, 'SELECT count(*) AS n FROM class_session'),
    count(db, 'SELECT count(*) AS n FROM workout_set WHERE effort IS NOT NULL'),
    count(db, 'SELECT count(*) AS n FROM meal_plan'),
    db.getFirst<{ enabled: number }>("SELECT enabled FROM reminder WHERE id = 'creatine'"),
    db.getFirst<{ at: string | null }>(
      `SELECT min(at) AS at FROM (
         SELECT min(logged_at) AS at FROM food_log_entry
         UNION ALL SELECT min(started_at) FROM workout
         UNION ALL SELECT min(started_at) FROM class_session)`,
    ),
  ]);
  return { usage, snackTiles, classes, effortSets, creatineOn: creatine?.enabled === 1, plans, firstUseAt: first?.at ?? null };
}
