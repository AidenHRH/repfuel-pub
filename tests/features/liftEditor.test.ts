import { parseSets } from '@/features/workouts/LiftEditor';

test('sets parse to numbers; blank weight is bodyweight', () => {
  expect(
    parseSets([
      { weight: '22.5', reps: '10', effort: 8 },
      { weight: '', reps: '12', effort: null },
    ]),
  ).toEqual([
    { weightKg: 22.5, reps: 10, effort: 8 },
    { weightKg: null, reps: 12, effort: null },
  ]);
});

test('incomplete or impossible sets are not ready to save', () => {
  expect(parseSets([{ weight: '80', reps: '', effort: null }])).toBeNull();
  expect(parseSets([{ weight: '-5', reps: '8', effort: null }])).toBeNull();
  expect(parseSets([{ weight: '80', reps: '8.5', effort: null }])).toBeNull();
  expect(parseSets([{ weight: '80', reps: '0', effort: null }])).toBeNull();
  expect(parseSets([{ weight: 'abc', reps: '8', effort: null }])).toBeNull();
  expect(parseSets([])).toBeNull();
});

test('helped reps go with the set, never more than its reps', () => {
  expect(parseSets([{ weight: '100', reps: '6', effort: 10, assisted: 2 }])).toEqual([
    { weightKg: 100, reps: 6, effort: 10, assistedReps: 2 },
  ]);
  // Reps lowered after choosing how many were helped: all of them were.
  expect(parseSets([{ weight: '100', reps: '2', effort: 10, assisted: 3 }])).toEqual([
    { weightKg: 100, reps: 2, effort: 10, assistedReps: 2 },
  ]);
});
