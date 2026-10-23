/** A daily time, local to the phone. */
export type DailyTime = { hour: number; minute: number };

/** How many days of reminders are scheduled ahead; the app tops them up whenever it opens. */
export const DAYS_AHEAD = 14;

/**
 * The next reminders at a daily local time: today's if it's still ahead and not already done, then one a day.
 * Built from calendar days, so the local time holds when the clocks change.
 */
export function reminderTimes({
  hour,
  minute,
  now,
  takenToday,
  days = DAYS_AHEAD,
}: DailyTime & { now: Date; takenToday: boolean; days?: number }): Date[] {
  const times: Date[] = [];
  for (let offset = 0; times.length < days; offset++) {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0);
    if (offset === 0 && (takenToday || t <= now)) continue;
    times.push(t);
  }
  return times;
}

export function timeLabel(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Moves a daily time by some minutes, wrapping round midnight. */
export function shiftTime({ hour, minute }: DailyTime, minutes: number): DailyTime {
  const total = (((hour * 60 + minute + minutes) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}
