import { localDayKey } from './dates';
import type { MuscleGroup } from './exercises';
import { estimatedOneRepMax, exerciseRecords, newRecords, type LiftSet } from './records';

/** A logged set with the exercise it belongs to, for the Progress charts. */
export type ProgressSet = LiftSet & { exerciseId: string; exerciseName: string; muscleGroup: MuscleGroup };
export type ClassEffort = { at: string; effort: number | null };

export type Range = '4w' | '12w' | '1y';
export const RANGE_WEEKS: Record<Range, number> = { '4w': 4, '12w': 12, '1y': 52 };
export const RANGE_LABELS: Record<Range, string> = { '4w': '4 weeks', '12w': '12 weeks', '1y': '1 year' };

/** Sets at this effort or more count as hard; unrated sets count too (a logged working set). */
export const HARD_EFFORT = 7;

const DAY = 86_400_000;
const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** The Monday (local) of the week holding `at`, as YYYY-MM-DD. */
export function weekOf(at: Date | string): string {
  const d = new Date(at);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  local.setDate(local.getDate() - ((local.getDay() + 6) % 7));
  return localDayKey(local);
}

const mondayDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** The Mondays of the range, oldest first, ending with this week. */
export function weekStarts(range: Range, now: Date = new Date()): string[] {
  const last = mondayDate(weekOf(now));
  return Array.from({ length: RANGE_WEEKS[range] }, (_, i) => {
    const d = new Date(last);
    d.setDate(d.getDate() - 7 * (RANGE_WEEKS[range] - 1 - i));
    return localDayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
  });
}

/** Weight moved by a set in kg: weight × every rep (helped reps moved the weight too). Bodyweight and timed: 0. */
const setVolume = (s: LiftSet) => (s.weightKg && s.reps ? s.weightKg * s.reps : 0);

function byWeek<T extends { at: string }>(items: T[], weeks: string[]): Map<string, T[]> {
  const wanted = new Set(weeks);
  const map = new Map<string, T[]>(weeks.map((w) => [w, []]));
  for (const it of items) {
    const w = weekOf(it.at);
    if (wanted.has(w)) map.get(w)!.push(it);
  }
  return map;
}

/** Average effort each week; null for a week with nothing rated. */
export function weeklyEffort(sets: LiftSet[], weeks: string[]): (number | null)[] {
  const map = byWeek(sets, weeks);
  return weeks.map((w) => {
    const m = mean(map.get(w)!.flatMap((s) => (s.effort == null ? [] : [s.effort])));
    return m === null ? null : round(m, 1);
  });
}

/** Tonnes lifted each week (a week off is 0). */
export function weeklyTonnage(sets: LiftSet[], weeks: string[]): number[] {
  const map = byWeek(sets, weeks);
  return weeks.map((w) => round(map.get(w)!.reduce((t, s) => t + setVolume(s), 0) / 1000, 2));
}

/** Workouts (ids) that set any record, replaying every exercise's history in order with the record rules. */
export function prWorkoutIds(sets: ProgressSet[]): Set<string> {
  const ids = new Set<string>();
  const byExercise = new Map<string, ProgressSet[]>();
  for (const s of sets) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
  for (const list of byExercise.values()) {
    const ordered = [...list].sort((a, b) => a.at.localeCompare(b.at));
    const workouts: ProgressSet[][] = [];
    for (const s of ordered) {
      const last = workouts.at(-1);
      if (last && last[0].workoutId === s.workoutId) last.push(s);
      else workouts.push([s]);
    }
    const history: LiftSet[] = [];
    for (const w of workouts) {
      if (newRecords(history, w).length) ids.add(w[0].workoutId);
      history.push(...w);
    }
  }
  return ids;
}

export type Overview = {
  workouts: number;
  workoutsBefore: number;
  tonnes: number;
  tonnesBefore: number;
  avgEffort: number | null;
  newPrs: number;
};

/** The headline numbers for a range, each against the same length of time before it. */
export function overview(sets: ProgressSet[], classes: ClassEffort[], range: Range, now: Date = new Date()): Overview {
  const start = mondayDate(weekStarts(range, now)[0]).getTime();
  const before = start - RANGE_WEEKS[range] * 7 * DAY;
  const inRange = (at: string) => Date.parse(at) >= start && Date.parse(at) <= now.getTime();
  const inBefore = (at: string) => Date.parse(at) >= before && Date.parse(at) < start;
  const days = (test: (at: string) => boolean) =>
    new Set([...sets.map((s) => s.at), ...classes.map((c) => c.at)].filter(test).map((at) => localDayKey(new Date(at)))).size;
  const tonnes = (test: (at: string) => boolean) => sets.filter((s) => test(s.at)).reduce((t, s) => t + setVolume(s), 0) / 1000;
  const efforts = [...sets, ...classes].filter((x) => inRange(x.at)).flatMap((x) => (x.effort == null ? [] : [x.effort]));
  const prs = prWorkoutIds(sets);
  const prsInRange = new Set(sets.filter((s) => prs.has(s.workoutId) && inRange(s.at)).map((s) => s.workoutId));
  return {
    workouts: days(inRange),
    workoutsBefore: days(inBefore),
    tonnes: round(tonnes(inRange), 2),
    tonnesBefore: round(tonnes(inBefore), 2),
    avgEffort: efforts.length ? round(mean(efforts)!, 2) : null,
    newPrs: prsInRange.size,
  };
}

/** Hard sets a week per muscle over the last `weeks` weeks, most first; muscles with none are left out. */
export function hardSetsPerMuscle(
  sets: ProgressSet[],
  now: Date = new Date(),
  weeks = 4,
): { muscle: MuscleGroup; perWeek: number }[] {
  const start = mondayDate(weekStarts('1y', now)[RANGE_WEEKS['1y'] - Math.min(weeks, RANGE_WEEKS['1y'])]).getTime();
  const counts = new Map<MuscleGroup, number>();
  for (const s of sets) {
    if (Date.parse(s.at) < start || Date.parse(s.at) > now.getTime()) continue;
    if (s.effort != null && s.effort < HARD_EFFORT) continue;
    counts.set(s.muscleGroup, (counts.get(s.muscleGroup) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([muscle, c]) => ({ muscle, perWeek: round(c / weeks, 2) }))
    .sort((a, b) => b.perWeek - a.perWeek);
}

export type LiftSession = {
  workoutId: string;
  at: string;
  sets: ProgressSet[];
  /** Best estimated 1-rep max of the session's sets done alone; null when none can be estimated. */
  e1rm: number | null;
  heaviestKg: number | null;
  volumeKg: number;
  effort: number | null;
};

const soloReps = (s: LiftSet) => (s.reps ?? 0) - (s.assistedReps ?? 0);

/** One exercise's sessions, oldest first. */
export function liftSessions(sets: ProgressSet[], exerciseId: string): LiftSession[] {
  const groups = new Map<string, ProgressSet[]>();
  for (const s of [...sets].filter((x) => x.exerciseId === exerciseId).sort((a, b) => a.at.localeCompare(b.at))) {
    groups.set(s.workoutId, [...(groups.get(s.workoutId) ?? []), s]);
  }
  return [...groups.values()].map((list) => {
    const estimates = list.flatMap((s) => {
      const e = estimatedOneRepMax(s.weightKg, soloReps(s));
      return e === null ? [] : [e];
    });
    const weights = list.flatMap((s) => (s.weightKg == null ? [] : [s.weightKg]));
    const efforts = list.flatMap((s) => (s.effort == null ? [] : [s.effort]));
    return {
      workoutId: list[0].workoutId,
      at: list[0].at,
      sets: list,
      e1rm: estimates.length ? Math.max(...estimates) : null,
      heaviestKg: weights.length ? Math.max(...weights) : null,
      volumeKg: list.reduce((t, s) => t + setVolume(s), 0),
      effort: efforts.length ? round(mean(efforts)!, 1) : null,
    };
  });
}

/** Effort on the weight × reps done in the most sessions (3 or more), one point per session. */
export function sameWeightEffort(
  sessions: LiftSession[],
): { weightKg: number; reps: number; points: { at: string; effort: number }[] } | null {
  const seen = new Map<string, { weightKg: number; reps: number; points: { at: string; effort: number }[] }>();
  for (const session of sessions) {
    const pairs = new Map<string, number[]>();
    for (const s of session.sets) {
      if (s.weightKg == null || !s.reps || s.effort == null) continue;
      const key = `${s.weightKg}×${s.reps}`;
      pairs.set(key, [...(pairs.get(key) ?? []), s.effort]);
    }
    for (const [key, efforts] of pairs) {
      const [w, r] = key.split('×').map(Number);
      const entry = seen.get(key) ?? { weightKg: w, reps: r, points: [] };
      entry.points.push({ at: session.at, effort: round(mean(efforts)!, 1) });
      seen.set(key, entry);
    }
  }
  const best = [...seen.values()].sort((a, b) => b.points.length - a.points.length || b.weightKg - a.weightKg)[0];
  return best && best.points.length >= 3 ? best : null;
}

/** Best estimated 1-rep max per week (null in weeks without one), the latest value and the change over the range. */
export function liftTrend(
  sets: ProgressSet[],
  exerciseId: string,
  weeks: string[],
): { points: (number | null)[]; latest: number | null; change: number | null } {
  const map = byWeek(liftSessions(sets, exerciseId), weeks);
  const points = weeks.map((w) => {
    const values = map.get(w)!.flatMap((s) => (s.e1rm === null ? [] : [s.e1rm]));
    return values.length ? round(Math.max(...values), 1) : null;
  });
  const known = points.filter((p): p is number => p !== null);
  return {
    points,
    latest: known.at(-1) ?? null,
    change: known.length >= 2 ? round(known.at(-1)! - known[0], 1) : null,
  };
}

/** A plain one-line reading of the effort line, or null when there's too little to say. */
export function effortTakeaway(effort: (number | null)[], tonnes: number[]): string | null {
  const known = effort.filter((e): e is number => e !== null);
  if (known.length < 3) return null;
  const first = known[0];
  const last = known.at(-1)!;
  const lifted = tonnes.filter((t) => t > 0);
  const liftingMore = lifted.length >= 2 && lifted.at(-1)! > lifted[0];
  if (last <= first - 0.5)
    return `Down from ${first} to ${last}${liftingMore ? ' while you lifted more' : ': sets are feeling easier'}.`;
  if (last >= first + 0.5) return `Up from ${first} to ${last}: sets are feeling harder.`;
  return `Steady at about ${round(mean(known)!, 1)}.`;
}

export type MuscleProgress = {
  hardSetsPerWeek: number;
  avgEffort: number | null;
  prs: number;
  /** Strength change per week in %, against where each lift started in the range; null in weeks without data. */
  strength: (number | null)[];
  weeklySets: number[];
  weeklyEffort: (number | null)[];
  lifts: { exerciseId: string; name: string; latest: number | null; change: number | null; points: (number | null)[] }[];
  currentPrs: { exerciseId: string; name: string; label: string }[];
  workouts: { day: string; lifts: string[]; effort: number | null; prs: number }[];
};

/** Everything on a muscle's page for a range. */
export function muscleProgress(sets: ProgressSet[], muscle: MuscleGroup, range: Range, now: Date = new Date()): MuscleProgress {
  const weeks = weekStarts(range, now);
  const start = mondayDate(weeks[0]).getTime();
  const all = sets.filter((s) => s.muscleGroup === muscle);
  const recent = all.filter((s) => Date.parse(s.at) >= start && Date.parse(s.at) <= now.getTime());
  const hard = (s: LiftSet) => s.effort == null || s.effort >= HARD_EFFORT;
  const prs = prWorkoutIds(sets);

  const exerciseIds = [...new Set(recent.map((s) => s.exerciseId))];
  const sessionsOf = (id: string) => new Set(recent.filter((s) => s.exerciseId === id).map((s) => s.workoutId)).size;
  const nameOf = (id: string) => all.find((s) => s.exerciseId === id)!.exerciseName;
  exerciseIds.sort((a, b) => sessionsOf(b) - sessionsOf(a) || nameOf(a).localeCompare(nameOf(b)));
  const lifts = exerciseIds.map((id) => ({ exerciseId: id, name: nameOf(id), ...liftTrend(all, id, weeks) }));

  // Each lift with 2+ sessions, as % of its first estimate in the range; the muscle's line is their average.
  const ratios = lifts
    .filter((l) => sessionsOf(l.exerciseId) >= 2)
    .map((l) => {
      const first = l.points.find((p): p is number => p !== null)!;
      return l.points.map((p) => (p === null ? null : (p / first - 1) * 100));
    });
  const strength = weeks.map((_, i) => {
    const m = mean(ratios.flatMap((r) => (r[i] === null ? [] : [r[i]!])));
    return m === null ? null : round(m, 1);
  });

  const currentPrs = exerciseIds.flatMap((id) => {
    const r = exerciseRecords(all.filter((s) => s.exerciseId === id));
    if (r.heaviest)
      return [{ exerciseId: id, name: nameOf(id), label: `${round(r.heaviest.weightKg!, 2)} kg × ${r.heaviest.reps}` }];
    if (r.mostReps) return [{ exerciseId: id, name: nameOf(id), label: `${r.mostReps.reps} reps` }];
    return [];
  });

  const byDay = new Map<string, ProgressSet[]>();
  for (const s of recent) {
    const day = localDayKey(new Date(s.at));
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  const workouts = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => {
      const efforts = list.flatMap((s) => (s.effort == null ? [] : [s.effort]));
      return {
        day,
        lifts: [...new Set(list.map((s) => s.exerciseName))].sort(),
        effort: efforts.length ? round(mean(efforts)!, 1) : null,
        prs: new Set(list.filter((s) => prs.has(s.workoutId)).map((s) => s.workoutId)).size,
      };
    });

  const setsByWeek = byWeek(recent, weeks);
  const efforts = recent.flatMap((s) => (s.effort == null ? [] : [s.effort]));
  return {
    hardSetsPerWeek: round(recent.filter(hard).length / weeks.length, 1),
    avgEffort: efforts.length ? round(mean(efforts)!, 1) : null,
    prs: workouts.reduce((t, w) => t + w.prs, 0),
    strength,
    weeklySets: weeks.map((w) => setsByWeek.get(w)!.filter(hard).length),
    weeklyEffort: weeklyEffort(recent, weeks),
    lifts,
    currentPrs,
    workouts,
  };
}
