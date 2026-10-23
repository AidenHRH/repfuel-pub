import { estimatedOneRepMax, exerciseRecords, newRecords, type LiftSet } from '@/domain/records';

const set = (weightKg: number | null, reps: number, at = '2026-10-20T18:00:00Z', workoutId = 'w1'): LiftSet => ({
  workoutId,
  at,
  weightKg,
  reps,
  effort: null,
});

describe('estimatedOneRepMax (Epley)', () => {
  test('100 kg × 5 ≈ 116.7 kg', () => {
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
  });
  test('a single is its own max', () => {
    expect(estimatedOneRepMax(120, 1)).toBeCloseTo(124, 0);
  });
  test('more than 12 reps or no weight gives no estimate', () => {
    expect(estimatedOneRepMax(60, 13)).toBeNull();
    expect(estimatedOneRepMax(null, 8)).toBeNull();
  });
});

describe('exerciseRecords', () => {
  test('finds the heaviest set, best estimate and reps at each weight', () => {
    const r = exerciseRecords([set(80, 8), set(85, 5, '2026-10-21T18:00:00Z', 'w2'), set(80, 9, '2026-10-22T18:00:00Z', 'w3')]);
    expect(r.heaviest).toMatchObject({ weightKg: 85, reps: 5, workoutId: 'w2' });
    expect(r.repsAtWeight.get(80)).toMatchObject({ reps: 9, workoutId: 'w3' });
    expect(r.bestE1rm?.value).toBeCloseTo(104, 0); // 80 × (1 + 9/30) = 104
  });

  test('the earliest set wins a tie', () => {
    const r = exerciseRecords([set(85, 5, '2026-10-21T18:00:00Z', 'w2'), set(85, 5, '2026-10-22T18:00:00Z', 'w3')]);
    expect(r.heaviest?.workoutId).toBe('w2');
  });

  test('bodyweight exercises track most reps, no weight records', () => {
    const r = exerciseRecords([set(null, 12), set(null, 15, '2026-10-22T18:00:00Z', 'w2')]);
    expect(r.heaviest).toBeNull();
    expect(r.bestE1rm).toBeNull();
    expect(r.mostReps).toMatchObject({ reps: 15, workoutId: 'w2' });
  });

  test('no sets, no records', () => {
    const r = exerciseRecords([]);
    expect(r.heaviest).toBeNull();
    expect(r.mostReps).toBeNull();
  });
});

describe('newRecords', () => {
  const history = [set(80, 8), set(82.5, 6, '2026-10-21T18:00:00Z', 'w2')];

  test('a first-ever log is a baseline, not a PR', () => {
    expect(newRecords([], [set(80, 8, '2026-10-22T18:00:00Z', 'w9')])).toEqual([]);
  });

  test('a heavier set is a PR with the previous best', () => {
    const events = newRecords(history, [set(85, 5, '2026-10-22T18:00:00Z', 'w9')]);
    expect(events.find((e) => e.type === 'heaviest')).toMatchObject({
      value: 85,
      previous: 82.5,
      label: 'Heaviest ever: 85 kg (was 82.5 kg)',
    });
  });

  test('more reps at a weight you have lifted before is a rep PR', () => {
    const events = newRecords(history, [set(80, 9, '2026-10-22T18:00:00Z', 'w9')]);
    expect(events.find((e) => e.type === 'reps_at_weight')).toMatchObject({ label: 'Most reps at 80 kg: 9 (was 8)' });
  });

  test('a better estimated max is labelled as an estimate', () => {
    const events = newRecords(history, [set(80, 10, '2026-10-22T18:00:00Z', 'w9')]);
    const e1rm = events.find((e) => e.type === 'e1rm');
    expect(e1rm?.label).toMatch(/^Estimated 1RM: 107 kg \(estimate, was \d+ kg\)$/);
  });

  test('a tie is not a PR', () => {
    expect(newRecords(history, [set(82.5, 6, '2026-10-22T18:00:00Z', 'w9')])).toEqual([]);
  });

  test('several sets in one lift give at most one message of each kind', () => {
    const events = newRecords(history, [set(85, 3, '2026-10-22T18:00:00Z', 'w9'), set(87.5, 2, '2026-10-22T18:05:00Z', 'w9')]);
    const heaviest = events.filter((e) => e.type === 'heaviest');
    expect(heaviest).toHaveLength(1);
    expect(heaviest[0].value).toBe(87.5);
  });

  test('a weight never lifted before is not a reps-at-weight PR', () => {
    const events = newRecords(history, [set(70, 12, '2026-10-22T18:00:00Z', 'w9')]);
    expect(events.find((e) => e.type === 'reps_at_weight')).toBeUndefined();
  });

  test('bodyweight: more reps than ever before', () => {
    const events = newRecords([set(null, 12)], [set(null, 14, '2026-10-22T18:00:00Z', 'w9')]);
    expect(events).toEqual([expect.objectContaining({ type: 'most_reps', label: 'Most reps: 14 (was 12)' })]);
  });
});

describe('timed and reps-only sets', () => {
  const hold = (seconds: number, at: string): LiftSet => ({
    workoutId: at,
    at,
    weightKg: null,
    reps: null,
    effort: null,
    durationSeconds: seconds,
  });

  test('a longer plank is a longest-hold PR', () => {
    const events = newRecords([hold(85, '2026-10-19T18:00:00Z')], [hold(90, '2026-10-22T18:00:00Z')]);
    expect(events).toEqual([
      { type: 'longest_hold', value: 90, previous: 85, weightKg: null, label: 'Longest hold: 1:30 (was 1:25)' },
    ]);
  });

  test('a shorter or equal hold is not a record', () => {
    expect(newRecords([hold(90, '2026-10-19T18:00:00Z')], [hold(90, '2026-10-22T18:00:00Z')])).toEqual([]);
  });

  test('old weighted and new reps-only sets on one exercise give sane records', () => {
    const history = [set(10, 12, '2026-10-01T18:00:00Z')];
    const added = [set(null, 15, '2026-10-22T18:00:00Z')];
    const records = exerciseRecords([...history, ...added]);
    expect(records.mostReps?.reps).toBe(15);
    expect(records.heaviest?.weightKg).toBe(10);
    expect(records.longestHold).toBeNull();
    expect(() => newRecords(history, added)).not.toThrow();
  });
});
