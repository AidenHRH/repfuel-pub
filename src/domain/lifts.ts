import { localDayKey } from './dates';

export type SetLike = {
  weightKg: number | null;
  reps: number | null;
  effort: number | null;
  durationSeconds?: number | null;
  assistedReps?: number | null;
};

/** "(last 2 helped)", or "(helped)" when every rep was. */
export function helpedLabel(reps: number, assistedReps: number): string {
  return assistedReps >= reps ? '(helped)' : `(last ${assistedReps} helped)`;
}

const helped = (s: SetLike) => (s.assistedReps && s.reps ? ` ${helpedLabel(s.reps, s.assistedReps)}` : '');

/** "1:30" for 90 seconds. */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const isTimed = (s: SetLike) => s.durationSeconds != null;

const kg = (n: number) => `${Math.round(n * 100) / 100} kg`;

/** The set that best represents a lift: heaviest weight, then most reps; for timed sets, the longest. */
export function bestSet<T extends SetLike>(sets: T[]): T | null {
  return sets.reduce<T | null>((best, s) => {
    if (!best) return s;
    if (isTimed(s) || isTimed(best)) return (s.durationSeconds ?? 0) > (best.durationSeconds ?? 0) ? s : best;
    const w = s.weightKg ?? 0;
    const bw = best.weightKg ?? 0;
    return w > bw || (w === bw && (s.reps ?? 0) > (best.reps ?? 0)) ? s : best;
  }, null);
}

function setText(s: SetLike): string {
  if (isTimed(s)) return formatDuration(s.durationSeconds!);
  return `${s.weightKg === null ? `${s.reps} reps` : `${kg(s.weightKg)} × ${s.reps}`}${helped(s)}`;
}

/** "3 sets · best 85 kg × 5 @ 9" */
export function liftSummary(sets: SetLike[]): string {
  const best = bestSet(sets);
  if (!best) return 'No sets';
  const effort = best.effort !== null ? ` @ ${best.effort}` : '';
  return `${sets.length} set${sets.length === 1 ? '' : 's'} · best ${setText(best)}${effort}`;
}

/** "80 kg × 8, 8, 7 @ 8, 9, 9" when the weight is the same throughout, else each set in turn. */
export function setsLabel(sets: SetLike[]): string {
  if (sets.length === 0) return '';
  if (sets.every(isTimed)) return sets.map(setText).join(' · ');
  // Helped sets are listed one by one, so it's clear which set had help.
  const sameWeight = sets.every((s) => s.weightKg === sets[0].weightKg && !s.assistedReps);
  const efforts = sets.map((s) => s.effort).filter((e): e is number => e !== null);
  const effortText = efforts.length === sets.length ? ` @ ${efforts.join(', ')}` : '';
  if (sameWeight) {
    const w = sets[0].weightKg;
    return `${w === null ? '' : `${kg(w)} × `}${sets.map((s) => s.reps).join(', ')}${w === null ? ' reps' : ''}${effortText}`;
  }
  return sets.map((s) => `${setText(s)}${s.effort !== null ? ` @ ${s.effort}` : ''}`).join(' · ');
}

/** "Today", "Yesterday" or "Mon 20 Oct" for a lift's local day. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const day = localDayKey(new Date(iso));
  if (day === localDayKey(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDayKey(yesterday)) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "effort 7 → 9" (first to last rated set) or "effort 8" when steady; a nudge when every rated set was 6 or under. */
export function effortLine(sets: SetLike[]): { text: string; hint: string | null } | null {
  const rated = sets.flatMap((s) => (s.effort == null ? [] : [s.effort]));
  if (!rated.length) return null;
  const first = rated[0];
  const last = rated.at(-1)!;
  return {
    text: first === last ? `effort ${first}` : `effort ${first} → ${last}`,
    hint: rated.every((e) => e <= 6) ? 'Felt easy: try a bit more next time' : null,
  };
}
