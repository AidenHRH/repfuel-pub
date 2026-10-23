import { dayEffort } from '@/domain/training';
import { groupFeedByDay, weekSummary, type FeedItem } from '@/domain/training';

const now = new Date('2026-10-22T19:00:00'); // Thursday evening, local time
const lift = (name: string, at: string, isPr = false): FeedItem => ({
  kind: 'lift',
  isPr,
  lift: {
    workoutId: `${name}-${at}`,
    exerciseName: name,
    at: new Date(at).toISOString(),
    sets: [{ weightKg: null, reps: 12, effort: null }],
  },
});
const cls = (name: string, at: string, durationMin: number, effort: number): FeedItem => ({
  kind: 'class',
  session: { id: `${name}-${at}`, className: name, at: new Date(at).toISOString(), durationMin, effort, notes: null },
});

const items = [
  lift('Barbell bench press', '2026-10-22T18:05:00', true),
  cls('Hyrox', '2026-10-20T18:30:00', 60, 9),
  lift('Ab wheel rollout', '2026-10-19T18:00:00'),
  lift('Plank', '2026-10-19T18:20:00'),
  lift('Squat', '2026-10-12T18:00:00'),
];

test('the week: sessions, class time and PRs, Monday to Sunday', () => {
  const week = weekSummary(items, now);
  expect(week).toMatchObject({ sessions: 3, classMinutes: 60, prs: 1 });
  expect(week.days.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  expect(week.days.map((d) => [d.strength, d.classes])).toEqual([
    [true, false],
    [false, true],
    [false, false],
    [true, false],
    [false, false],
    [false, false],
    [false, false],
  ]);
  expect(week.days.findIndex((d) => d.isToday)).toBe(3);
});

test('a Sunday still belongs to the week that started on Monday', () => {
  const sunday = new Date('2026-10-25T20:00:00');
  expect(weekSummary(items, sunday).days[0].day).toBe('2026-10-19');
});

test('the feed is grouped by day, newest first, with weekday names this week', () => {
  const groups = groupFeedByDay(items, now);
  expect(groups.map((g) => g.label)).toEqual(['Today', 'Tuesday', 'Monday', 'Mon 12 Oct']);
  expect(groups[2].items.map((i) => (i.kind === 'lift' ? i.lift.exerciseName : ''))).toEqual(['Plank', 'Ab wheel rollout']);
});

test('a day’s effort averages every rated set and class', () => {
  const lift = (efforts: (number | null)[]) => ({
    kind: 'lift' as const,
    isPr: false,
    lift: {
      workoutId: 'w',
      exerciseId: 'e',
      exerciseName: 'Bench',
      at: '2026-10-20T18:00:00Z',
      notes: null,
      sets: efforts.map((effort) => ({ weightKg: 80, reps: 8, effort })),
    },
  });
  const cls = { kind: 'class' as const, session: { effort: 9 } } as never;
  expect(dayEffort([lift([7, 8, null]), cls])).toBe(8);
  expect(dayEffort([lift([null])])).toBeNull();
});
