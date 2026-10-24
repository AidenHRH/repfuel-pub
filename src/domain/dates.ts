/** The device-local calendar day for a moment, as YYYY-MM-DD. Daily nutrition groups by this. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local clock time as HH:MM (24-hour), e.g. "07:30". */
export function localTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const noon = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** The day `n` days after (or before, when negative) a YYYY-MM-DD day. */
export function addDays(day: string, n: number): string {
  const date = noon(day);
  date.setDate(date.getDate() + n);
  return localDayKey(date);
}

/** Monday to Sunday of the week holding `day`. */
export function weekOf(day: string): string[] {
  const monday = addDays(day, -((noon(day).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Yesterday", else "Mon 19 Oct". */
export function dayTitle(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  const d = noon(day);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** One letter per weekday, Monday first, for the week's dots. */
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
