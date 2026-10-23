import { localDayKey } from './dates';
import { dayLabel, type SetLike } from './lifts';

export type FeedLift = { workoutId: string; exerciseName: string; at: string; sets: SetLike[] };
export type FeedClass = {
  id: string;
  className: string;
  at: string;
  durationMin: number;
  effort: number | null;
  notes: string | null;
};

/** One thing trained: a lift (with whether it set a PR) or a class. */
export type FeedItem = { kind: 'lift'; lift: FeedLift; isPr: boolean } | { kind: 'class'; session: FeedClass };

export type WeekDay = { day: string; label: 'M' | 'T' | 'W' | 'F' | 'S'; strength: boolean; classes: boolean; isToday: boolean };
export type WeekSummary = { sessions: number; classMinutes: number; prs: number; days: WeekDay[] };

const LETTERS: WeekDay['label'][] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const itemAt = (item: FeedItem) => (item.kind === 'lift' ? item.lift.at : item.session.at);

/** Monday 00:00 (local) of the week holding `now`. */
function mondayOf(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** This week (Monday to Sunday): strength days count as one session each, every class is a session. */
export function weekSummary(items: FeedItem[], now: Date): WeekSummary {
  const start = mondayOf(now);
  const days = LETTERS.map((label, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { day: localDayKey(d), label, strength: false, classes: false, isToday: localDayKey(d) === localDayKey(now) };
  });
  const byDay = new Map(days.map((d) => [d.day, d]));
  let classes = 0;
  let classMinutes = 0;
  let prs = 0;
  for (const item of items) {
    const day = byDay.get(localDayKey(new Date(itemAt(item))));
    if (!day) continue;
    if (item.kind === 'lift') {
      day.strength = true;
      if (item.isPr) prs++;
    } else {
      day.classes = true;
      classes++;
      classMinutes += item.session.durationMin;
    }
  }
  return { sessions: days.filter((d) => d.strength).length + classes, classMinutes, prs, days };
}

/** The feed by day, newest first: "Today", "Yesterday", weekday names this week, then dates. */
export function groupFeedByDay(items: FeedItem[], now: Date): { day: string; label: string; items: FeedItem[] }[] {
  const weekStart = localDayKey(mondayOf(now));
  const sorted = [...items].sort((a, b) => itemAt(b).localeCompare(itemAt(a)));
  const groups: { day: string; label: string; items: FeedItem[] }[] = [];
  for (const item of sorted) {
    const at = new Date(itemAt(item));
    const day = localDayKey(at);
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      const relative = dayLabel(at.toISOString(), now);
      const label =
        relative === 'Today' || relative === 'Yesterday' || day < weekStart
          ? relative
          : at.toLocaleDateString('en-GB', { weekday: 'long' });
      group = { day, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
