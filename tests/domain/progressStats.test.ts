import {
  effortTakeaway,
  hardSetsPerMuscle,
  liftSessions,
  liftTrend,
  muscleProgress,
  overview,
  sameWeightEffort,
  weekStarts,
  weeklyEffort,
  weeklyTonnage,
  type ProgressSet,
} from '@/domain/progressStats';

// Wednesday 22 Oct 2026, midday London.
const NOW = new Date('2026-10-22T11:00:00Z');

let n = 0;
function set(
  at: string,
  weightKg: number | null,
  reps: number,
  effort: number | null,
  over: Partial<ProgressSet> = {},
): ProgressSet {
  n += 1;
  return {
    workoutId: over.workoutId ?? `w-${at}-${over.exerciseId ?? 'bench'}`,
    at: `${at}T18:00:00.000Z`,
    weightKg,
    reps,
    effort,
    exerciseId: 'bench',
    exerciseName: 'Bench press',
    muscleGroup: 'chest',
    ...over,
  };
}

describe('weekStarts', () => {
  test('Mondays, oldest first, ending with this week', () => {
    expect(weekStarts('4w', NOW)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']);
    expect(weekStarts('12w', NOW)).toHaveLength(12);
    expect(weekStarts('1y', NOW)).toHaveLength(52);
  });
});

describe('weekly series', () => {
  const weeks = weekStarts('4w', NOW);
  const sets = [
    set('2026-10-06', 80, 8, 8),
    set('2026-10-06', 80, 8, 9),
    set('2026-10-20', 80, 8, 6),
    set('2026-10-20', null, 12, null, { exerciseId: 'dips', exerciseName: 'Dips' }),
  ];

  test('effort is the weekly average, unknown where nothing was rated', () => {
    expect(weeklyEffort(sets, weeks)).toEqual([null, 8.5, null, 6]);
  });

  test('weight lifted is weight × reps in tonnes; a week off is 0, bodyweight sets add nothing', () => {
    expect(weeklyTonnage(sets, weeks)).toEqual([0, 1.28, 0, 0.64]);
  });
});

describe('overview', () => {
  test('counts training days, tonnes, effort and lifts that set a record, against the period before', () => {
    const sets = [
      set('2026-09-08', 70, 8, 9),
      set('2026-09-29', 75, 8, 8),
      set('2026-10-13', 80, 8, 8),
      set('2026-10-20', 80, 8, 7),
    ];
    const o = overview(sets, [{ at: '2026-10-15T18:00:00.000Z', effort: 8 }], '4w', NOW);
    expect(o.workouts).toBe(4);
    expect(o.workoutsBefore).toBe(1);
    expect(o.tonnes).toBeCloseTo(1.88);
    expect(o.tonnesBefore).toBeCloseTo(0.56);
    expect(o.avgEffort).toBeCloseTo(7.75, 2); // sets and the class
    expect(o.newPrs).toBe(2);
  });

  test('nothing logged: zero counts and unknown effort', () => {
    expect(overview([], [], '12w', NOW)).toMatchObject({ workouts: 0, tonnes: 0, avgEffort: null, newPrs: 0 });
  });
});

test('hard sets per muscle: effort 7+ or unrated, a week, over the last 4 weeks', () => {
  const sets = [
    set('2026-10-20', 80, 8, 8),
    set('2026-10-20', 80, 8, 5),
    set('2026-10-13', 80, 8, null),
    set('2026-10-13', 100, 5, 8, { exerciseId: 'squat', exerciseName: 'Squat', muscleGroup: 'legs' }),
    set('2026-08-01', 80, 8, 8),
  ];
  expect(hardSetsPerMuscle(sets, NOW)).toEqual([
    { muscle: 'chest', perWeek: 0.5 },
    { muscle: 'legs', perWeek: 0.25 },
  ]);
});

describe('a lift', () => {
  const sets = [
    set('2026-09-01', 80, 8, 9),
    set('2026-09-01', 80, 8, 9),
    set('2026-09-15', 80, 8, 8),
    set('2026-10-01', 80, 8, 7),
    set('2026-10-20', 85, 6, 9),
  ];

  test('sessions: best estimate, heaviest, volume and average effort', () => {
    const s = liftSessions(sets, 'bench');
    expect(s).toHaveLength(4);
    expect(s[0]).toMatchObject({ heaviestKg: 80, volumeKg: 1280, effort: 9 });
    expect(s[0].e1rm).toBeCloseTo(101.3, 1);
    expect(s[3].heaviestKg).toBe(85);
  });

  test('same weight, getting easier: the most repeated weight × reps, 3 sessions or more', () => {
    expect(sameWeightEffort(liftSessions(sets, 'bench'))).toEqual({
      weightKg: 80,
      reps: 8,
      points: [
        { at: '2026-09-01T18:00:00.000Z', effort: 9 },
        { at: '2026-09-15T18:00:00.000Z', effort: 8 },
        { at: '2026-10-01T18:00:00.000Z', effort: 7 },
      ],
    });
    expect(sameWeightEffort(liftSessions(sets.slice(0, 3), 'bench'))).toBeNull();
  });

  test('trend: best estimate per week, unknown in weeks without it', () => {
    const weeks = weekStarts('4w', NOW);
    const t = liftTrend(sets, 'bench', weeks);
    expect(t.points.map((p) => (p === null ? null : Math.round(p)))).toEqual([101, null, null, 102]);
    expect(t.latest).toBeCloseTo(102, 0);
  });
});

describe('effortTakeaway', () => {
  test('easier while lifting more', () => {
    expect(effortTakeaway([7.8, 7.6, 7.4, 7.0, 6.8, 6.7], [14, 15, 16, 18, 19, 20])).toBe(
      'Down from 7.8 to 6.7 while you lifted more.',
    );
  });
  test('harder: says so plainly', () => {
    expect(effortTakeaway([6.5, 6.8, 7.2, 7.6], [10, 10, 10, 10])).toBe('Up from 6.5 to 7.6: sets are feeling harder.');
  });
  test('too little to say anything', () => {
    expect(effortTakeaway([7, null, null], [1, 0, 0])).toBeNull();
  });
});

test('a muscle: PRs, lifts, workouts and strength against where each lift started', () => {
  const sets = [
    set('2026-09-29', 80, 8, 8),
    set('2026-10-13', 85, 8, 8),
    set('2026-10-13', 28, 10, 7, { exerciseId: 'incline', exerciseName: 'Incline press', workoutId: 'w-inc' }),
    set('2026-10-20', 90, 8, 9),
    set('2026-10-20', 100, 5, 8, { exerciseId: 'squat', exerciseName: 'Squat', muscleGroup: 'legs' }),
  ];
  const m = muscleProgress(sets, 'chest', '4w', NOW);
  expect(m.lifts.map((l) => l.name)).toEqual(['Bench press', 'Incline press']);
  expect(m.currentPrs.map((p) => `${p.name}: ${p.label}`)).toEqual(['Bench press: 90 kg × 8', 'Incline press: 28 kg × 10']);
  expect(m.workouts.map((w) => `${w.day} ${w.lifts.join(', ')}`)).toEqual([
    '2026-10-20 Bench press',
    '2026-10-13 Bench press, Incline press',
    '2026-09-29 Bench press',
  ]);
  const strength = m.strength.filter((v): v is number => v !== null);
  expect(strength[0]).toBe(0);
  expect(strength.at(-1)).toBeCloseTo(12.5, 0);
  expect(m.avgEffort).toBeCloseTo(8, 1);
});
