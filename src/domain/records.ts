import { formatDuration, helpedLabel } from './lifts';

/**
 * One logged set, as used for personal records. `weightKg` null = bodyweight. A timed set (plank) has
 * `durationSeconds` and no reps.
 */
export type LiftSet = {
  workoutId: string;
  at: string;
  weightKg: number | null;
  reps: number | null;
  effort: number | null;
  durationSeconds?: number | null;
  /** The last reps of the set done with a spotter's help (none when null or missing). */
  assistedReps?: number | null;
};

export type RecordHolder = { weightKg: number | null; reps: number; at: string; workoutId: string };

export type ExerciseRecords = {
  heaviest: RecordHolder | null;
  bestE1rm: (RecordHolder & { value: number }) | null;
  mostReps: RecordHolder | null;
  repsAtWeight: Map<number, RecordHolder>;
  longestHold: { seconds: number; at: string; workoutId: string } | null;
  /** The best helped set, by its estimate with every rep counted. */
  bestSpotted: (RecordHolder & { value: number; assistedReps: number }) | null;
  /** The best estimate of any set with every rep counted, helped or not: what a Spotter PR has to beat. */
  bestAllReps: number | null;
};

export type RecordEvent = {
  type: 'heaviest' | 'e1rm' | 'reps_at_weight' | 'most_reps' | 'longest_hold' | 'spotter';
  value: number;
  previous: number | null;
  weightKg: number | null;
  label: string;
};

const MAX_REPS_FOR_ESTIMATE = 12;

/** Epley estimate of a one-rep max. Only for weighted sets of 1–12 reps; always an estimate. */
export function estimatedOneRepMax(weightKg: number | null, reps: number): number | null {
  if (weightKg === null || weightKg <= 0 || reps < 1 || reps > MAX_REPS_FOR_ESTIMATE) return null;
  return weightKg * (1 + reps / 30);
}

const holder = (s: LiftSet & { reps: number }): RecordHolder => ({
  weightKg: s.weightKg,
  reps: s.reps,
  at: s.at,
  workoutId: s.workoutId,
});

/**
 * Records for one exercise, worked out from every logged set. Earlier sets win ties. Solo records count only the
 * reps done alone; helped sets also compete, every rep counted, for the spotted best.
 */
export function exerciseRecords(sets: LiftSet[]): ExerciseRecords {
  const ordered = [...sets].sort((a, b) => a.at.localeCompare(b.at));
  const records: ExerciseRecords = {
    heaviest: null,
    bestE1rm: null,
    mostReps: null,
    repsAtWeight: new Map(),
    longestHold: null,
    bestSpotted: null,
    bestAllReps: null,
  };

  for (const t of ordered) {
    if (t.durationSeconds != null) {
      if (!records.longestHold || t.durationSeconds > records.longestHold.seconds) {
        records.longestHold = { seconds: t.durationSeconds, at: t.at, workoutId: t.workoutId };
      }
      continue;
    }
    if (t.reps === null) continue;
    const assisted = Math.min(t.assistedReps ?? 0, t.reps);
    const allReps = estimatedOneRepMax(t.weightKg, t.reps);
    if (allReps !== null) {
      if (records.bestAllReps === null || allReps > records.bestAllReps) records.bestAllReps = allReps;
      if (assisted > 0 && (!records.bestSpotted || allReps > records.bestSpotted.value)) {
        records.bestSpotted = { ...holder({ ...t, reps: t.reps }), value: allReps, assistedReps: assisted };
      }
    }
    // Solo records: only the reps done alone.
    if (t.reps - assisted < 1) continue;
    const s = { ...t, reps: t.reps - assisted };
    if (s.weightKg !== null && s.weightKg > 0) {
      if (!records.heaviest || s.weightKg > records.heaviest.weightKg!) records.heaviest = holder(s);
      const atWeight = records.repsAtWeight.get(s.weightKg);
      if (!atWeight || s.reps > atWeight.reps) records.repsAtWeight.set(s.weightKg, holder(s));
      const e1rm = estimatedOneRepMax(s.weightKg, s.reps);
      if (e1rm !== null && (!records.bestE1rm || e1rm > records.bestE1rm.value)) records.bestE1rm = { ...holder(s), value: e1rm };
    } else if (!records.mostReps || s.reps > records.mostReps.reps) {
      records.mostReps = holder(s);
    }
  }
  return records;
}

const kg = (n: number) => `${Math.round(n * 100) / 100} kg`;

/**
 * Genuine new records set by `added` compared with everything before it. A first-ever log is a
 * baseline (no events); ties are not records; at most one event of each kind.
 */
export function newRecords(history: LiftSet[], added: LiftSet[]): RecordEvent[] {
  if (history.length === 0 || added.length === 0) return [];
  const before = exerciseRecords(history);
  const after = exerciseRecords([...history, ...added]);
  const events: RecordEvent[] = [];

  if (before.heaviest && after.heaviest && after.heaviest.weightKg! > before.heaviest.weightKg!) {
    events.push({
      type: 'heaviest',
      value: after.heaviest.weightKg!,
      previous: before.heaviest.weightKg,
      weightKg: after.heaviest.weightKg,
      label: `Heaviest ever: ${kg(after.heaviest.weightKg!)} (was ${kg(before.heaviest.weightKg!)})`,
    });
  }

  // Best rep improvement at a weight lifted before; report the heaviest such weight.
  let repEvent: RecordEvent | null = null;
  for (const [weight, prev] of before.repsAtWeight) {
    const now = after.repsAtWeight.get(weight)!;
    if (now.reps > prev.reps && (!repEvent || weight > repEvent.weightKg!)) {
      repEvent = {
        type: 'reps_at_weight',
        value: now.reps,
        previous: prev.reps,
        weightKg: weight,
        label: `Most reps at ${kg(weight)}: ${now.reps} (was ${prev.reps})`,
      };
    }
  }
  if (repEvent) events.push(repEvent);

  if (before.bestE1rm && after.bestE1rm && after.bestE1rm.value > before.bestE1rm.value) {
    events.push({
      type: 'e1rm',
      value: after.bestE1rm.value,
      previous: before.bestE1rm.value,
      weightKg: after.bestE1rm.weightKg,
      label: `Estimated 1RM: ${Math.round(after.bestE1rm.value)} kg (estimate, was ${Math.round(before.bestE1rm.value)} kg)`,
    });
  }

  if (before.mostReps && after.mostReps && after.mostReps.reps > before.mostReps.reps) {
    events.push({
      type: 'most_reps',
      value: after.mostReps.reps,
      previous: before.mostReps.reps,
      weightKg: null,
      label: `Most reps: ${after.mostReps.reps} (was ${before.mostReps.reps})`,
    });
  }

  if (before.longestHold && after.longestHold && after.longestHold.seconds > before.longestHold.seconds) {
    events.push({
      type: 'longest_hold',
      value: after.longestHold.seconds,
      previous: before.longestHold.seconds,
      weightKg: null,
      label: `Longest hold: ${formatDuration(after.longestHold.seconds)} (was ${formatDuration(before.longestHold.seconds)})`,
    });
  }
  // Spotter PR: a helped set that, every rep counted, beats every earlier set.
  let spotted: { set: LiftSet & { reps: number }; value: number; assisted: number } | null = null;
  for (const t of added) {
    const assisted = Math.min(t.assistedReps ?? 0, t.reps ?? 0);
    const value = t.reps !== null && assisted > 0 ? estimatedOneRepMax(t.weightKg, t.reps) : null;
    if (value !== null && (!spotted || value > spotted.value)) spotted = { set: { ...t, reps: t.reps! }, value, assisted };
  }
  if (spotted && before.bestAllReps !== null && spotted.value > before.bestAllReps) {
    const { set, assisted, value } = spotted;
    events.push({
      type: 'spotter',
      value,
      previous: before.bestAllReps,
      weightKg: set.weightKg,
      label: `Spotter PR: ${kg(set.weightKg!)} × ${set.reps} ${helpedLabel(set.reps, assisted)}`,
    });
  }
  return events;
}
