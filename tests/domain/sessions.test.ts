import { groupSessions, sessionName } from '@/domain/sessions';
import type { FeedItem } from '@/domain/training';

const lift = (id: string, at: string, muscleGroup: string, effort: number | null = 7, isPr = false): FeedItem => ({
  kind: 'lift',
  isPr,
  lift: {
    workoutId: id,
    exerciseName: `Lift ${id}`,
    muscleGroup: muscleGroup as never,
    at: `2026-10-22T${at}:00.000Z`,
    sets: [
      { weightKg: 50, reps: 8, effort },
      { weightKg: 50, reps: 8, effort },
    ],
  },
});
const cls = (id: string, at: string): FeedItem => ({
  kind: 'class',
  session: { id, className: 'Hyrox', at: `2026-10-22T${at}:00.000Z`, durationMin: 60, effort: 8, notes: null },
});

test('lifts within an hour of the last one are one session; a longer gap starts another', () => {
  const sessions = groupSessions([lift('a', '11:20', 'shoulders'), lift('b', '11:45', 'shoulders'), lift('c', '17:05', 'chest'), lift('d', '17:30', 'triceps', 8, true)], {});
  expect(sessions.map((s) => [s.name, s.items.length])).toEqual([
    ['Chest & triceps', 2],
    ['Shoulders', 2],
  ]);
  expect(sessions[0]).toMatchObject({ id: 'c', sets: 4, exercises: 2, prs: 1, effort: 7.5 });
});

test('a class is always its own session', () => {
  const sessions = groupSessions([lift('a', '11:00', 'legs'), cls('h', '11:30')], {});
  expect(sessions.map((s) => s.name)).toEqual(['Hyrox', 'Legs']);
});

test('overrides: split starts a new session, join adds to the previous one', () => {
  const close = [lift('a', '11:00', 'back'), lift('b', '11:30', 'biceps'), lift('c', '11:50', 'biceps')];
  expect(groupSessions(close, { b: 'split' }).map((s) => s.items.length)).toEqual([2, 1]);
  const late = [lift('a', '11:00', 'back'), lift('c', '13:00', 'biceps')];
  expect(groupSessions(late, {}).map((s) => s.name)).toEqual(['Biceps', 'Back']);
  expect(groupSessions(late, { c: 'join' }).map((s) => s.name)).toEqual(['Back & biceps']);
});

test('names: one, two or more muscles', () => {
  expect(sessionName(['chest'])).toBe('Chest');
  expect(sessionName(['chest', 'triceps'])).toBe('Chest & triceps');
  expect(sessionName(['legs', 'core', 'shoulders'])).toBe('Legs, core & shoulders');
  expect(sessionName([])).toBe('Workout');
});
