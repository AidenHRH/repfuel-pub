import { localDayKey } from './dates';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from './exercises';
import { itemAt, type FeedItem } from './training';

/** A lift this soon after the previous one joins its session. */
export const SESSION_GAP_MIN = 60;

/** The owner's corrections: a lift that starts its own session, or joins the one before it. */
export type SessionBreaks = Record<string, 'split' | 'join'>;

export type Session = {
  /** The first item's id (a workout id, or a class id). */
  id: string;
  kind: 'strength' | 'class';
  name: string;
  start: string;
  items: FeedItem[];
  exercises: number;
  sets: number;
  prs: number;
  effort: number | null;
};

const itemId = (item: FeedItem) => (item.kind === 'lift' ? item.lift.workoutId : item.session.id);

/** "Chest", "Chest & triceps", "Legs, core & shoulders"; "Workout" when there are none. */
export function sessionName(muscles: MuscleGroup[]): string {
  const labels = muscles.map((m, i) => (i === 0 ? MUSCLE_GROUP_LABELS[m] : MUSCLE_GROUP_LABELS[m].toLowerCase()));
  if (labels.length === 0) return 'Workout';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} & ${labels.at(-1)}`;
}

function summarise(items: FeedItem[]): Session {
  const first = items[0];
  if (first.kind === 'class') {
    return {
      id: first.session.id,
      kind: 'class',
      name: first.session.className,
      start: first.session.at,
      items,
      exercises: 0,
      sets: 0,
      prs: 0,
      effort: first.session.effort,
    };
  }
  const lifts = items.flatMap((i) => (i.kind === 'lift' ? [i] : []));
  const muscles: MuscleGroup[] = [];
  for (const l of lifts) {
    const m = l.lift.muscleGroup;
    if (m && m !== 'other' && !muscles.includes(m)) muscles.push(m);
  }
  const efforts = lifts.flatMap((l) => l.lift.sets.flatMap((s) => (s.effort == null ? [] : [s.effort])));
  return {
    id: first.lift.workoutId,
    kind: 'strength',
    name: sessionName(muscles),
    start: first.lift.at,
    items,
    exercises: new Set(lifts.map((l) => l.lift.exerciseName)).size,
    sets: lifts.reduce((t, l) => t + l.lift.sets.length, 0),
    prs: lifts.filter((l) => l.isPr).length,
    effort: efforts.length ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10 : null,
  };
}

/** Training grouped into sessions, newest first: lifts within an hour of each other, each class on its own. */
export function groupSessions(items: FeedItem[], breaks: SessionBreaks): Session[] {
  const ordered = [...items].sort((a, b) => itemAt(a).localeCompare(itemAt(b)));
  const groups: FeedItem[][] = [];
  let current: FeedItem[] | null = null;
  for (const item of ordered) {
    if (item.kind === 'class') {
      groups.push([item]);
      continue;
    }
    const last = current?.at(-1);
    const override = breaks[item.lift.workoutId];
    const sameDay = last && localDayKey(new Date(itemAt(last))) === localDayKey(new Date(item.lift.at));
    const close = last && Date.parse(item.lift.at) - Date.parse(itemAt(last)) <= SESSION_GAP_MIN * 60_000;
    if (current && sameDay && override !== 'split' && (override === 'join' || close)) current.push(item);
    else {
      current = [item];
      groups.push(current);
    }
  }
  return groups.map(summarise).sort((a, b) => b.start.localeCompare(a.start));
}

export { itemId };
