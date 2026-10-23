/**
 * How hard a class felt, on the 1–10 session-RPE scale (CR-10), with a short label and a talk test so the
 * owner can pick quickly after a session.
 */
export const CLASS_EFFORT: Record<number, { label: string; description: string }> = {
  1: { label: 'Very easy', description: 'Could chat easily' },
  2: { label: 'Easy', description: 'Could chat easily' },
  3: { label: 'Moderate', description: 'Breathing harder' },
  4: { label: 'Somewhat hard', description: 'Breathing harder' },
  5: { label: 'Hard', description: 'Short sentences only' },
  6: { label: 'Hard+', description: 'Short sentences only' },
  7: { label: 'Very hard', description: 'A few words at a time' },
  8: { label: 'Very hard+', description: 'A few words at a time' },
  9: { label: 'Very, very hard', description: 'Could barely speak' },
  10: { label: 'Maximal', description: 'Nothing left' },
};

export function effortLabel(effort: number): string {
  return CLASS_EFFORT[effort]?.label ?? '';
}

/** "60 min", "1 h 30 min", "2 h": minutes up to 89, hours from 90. */
export function durationLabel(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
