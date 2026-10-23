import { effortLine } from '@/domain/lifts';
import { bestSet, dayLabel, formatDuration, liftSummary, setsLabel } from '@/domain/lifts';

const s = (weightKg: number | null, reps: number, effort: number | null = null) => ({ weightKg, reps, effort });

test('best set is the heaviest, then the most reps', () => {
  expect(bestSet([s(80, 8), s(85, 3), s(85, 5)])).toEqual(s(85, 5));
  expect(bestSet([])).toBeNull();
});

test('summaries read naturally for weighted and bodyweight lifts', () => {
  expect(liftSummary([s(80, 8, 7)])).toBe('1 set · best 80 kg × 8 @ 7');
  expect(liftSummary([s(null, 20), s(null, 15)])).toBe('2 sets · best 20 reps');
  expect(setsLabel([s(80, 8, 8), s(80, 8, 9), s(80, 7, 9)])).toBe('80 kg × 8, 8, 7 @ 8, 9, 9');
  expect(setsLabel([s(22.5, 10), s(25, 8, 9)])).toBe('22.5 kg × 10 · 25 kg × 8 @ 9');
  expect(setsLabel([s(null, 12), s(null, 10)])).toBe('12, 10 reps');
});

test('day labels use the local day', () => {
  const now = new Date('2026-10-22T17:30:00Z');
  expect(dayLabel('2026-10-22T07:00:00Z', now)).toBe('Today');
  expect(dayLabel('2026-10-21T22:30:00Z', now)).toBe('Yesterday');
  expect(dayLabel('2026-10-20T18:00:00Z', now)).toBe('Tue 20 Oct');
});

test('timed and reps-only sets read naturally', () => {
  const t = (durationSeconds: number) => ({ weightKg: null, reps: null, effort: null, durationSeconds });
  expect(setsLabel([t(90), t(75), t(70)])).toBe('1:30 · 1:15 · 1:10');
  expect(setsLabel([s(null, 15), s(null, 12), s(null, 12)])).toBe('15, 12, 12 reps');
  expect(liftSummary([t(90), t(75)])).toBe('2 sets · best 1:30');
  expect(formatDuration(90)).toBe('1:30');
  expect(formatDuration(5)).toBe('0:05');
  expect(formatDuration(3600)).toBe('60:00');
});

describe('effortLine', () => {
  const s = (effort: number | null) => ({ weightKg: 80, reps: 8, effort });
  test('first to last set, or one number when steady', () => {
    expect(effortLine([s(7), s(8), s(9)])).toEqual({ text: 'effort 7 → 9', hint: null });
    expect(effortLine([s(8), s(8)])).toEqual({ text: 'effort 8', hint: null });
  });
  test('every rated set at 6 or under suggests going heavier', () => {
    expect(effortLine([s(5), s(6), s(null)])).toEqual({ text: 'effort 5 → 6', hint: 'Felt easy: try a bit more next time' });
  });
  test('nothing rated: no line', () => {
    expect(effortLine([s(null)])).toBeNull();
  });
});
