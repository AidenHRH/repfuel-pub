import { setsLabel } from '@/domain/lifts';
import { exerciseRecords, newRecords, type LiftSet } from '@/domain/records';

const set = (at: string, weightKg: number, reps: number, assistedReps?: number, effort: number | null = null): LiftSet => ({
  workoutId: at,
  at: `2026-10-${at}T18:00:00.000Z`,
  weightKg,
  reps,
  effort,
  ...(assistedReps ? { assistedReps } : {}),
});

test('solo records count only the reps done alone', () => {
  const records = exerciseRecords([set('20', 100, 5), set('22', 110, 3, 3), set('23', 100, 6, 2)]);
  expect(records.heaviest).toMatchObject({ weightKg: 100, reps: 5 });
  expect(records.repsAtWeight.get(100)).toMatchObject({ reps: 5 });
  expect(records.repsAtWeight.has(110)).toBe(false);
  expect(records.bestSpotted).toMatchObject({ weightKg: 110, reps: 3, assistedReps: 3 });
});

test('a helped set that beats everything when every rep counts is a Spotter PR, not a solo one', () => {
  expect(newRecords([set('20', 100, 5)], [set('23', 100, 6, 2)])).toEqual([
    expect.objectContaining({ type: 'spotter', label: 'Spotter PR: 100 kg × 6 (last 2 helped)' }),
  ]);
  // Heavier than ever, but only with help: no solo Heaviest.
  expect(newRecords([set('20', 100, 3)], [set('23', 110, 1, 1)]).map((e) => e.type)).toEqual(['spotter']);
});

test('the solo part of a helped set can still be a solo PR', () => {
  const events = newRecords([set('20', 100, 3)], [set('23', 100, 6, 2)]);
  expect(events.map((e) => e.type).sort()).toEqual(['e1rm', 'reps_at_weight', 'spotter']);
  expect(events.find((e) => e.type === 'reps_at_weight')!.label).toBe('Most reps at 100 kg: 4 (was 3)');
});

test('a helped set that beats nothing is no record at all', () => {
  expect(newRecords([set('20', 120, 5)], [set('23', 100, 6, 2)])).toEqual([]);
});

test('helped sets are shown set by set', () => {
  expect(setsLabel([{ ...set('23', 100, 6, 2, 10) }, set('23', 100, 5, undefined, 9)])).toBe(
    '100 kg × 6 (last 2 helped) @ 10 · 100 kg × 5 @ 9',
  );
  expect(setsLabel([set('23', 100, 1, 1)])).toBe('100 kg × 1 (helped)');
});
