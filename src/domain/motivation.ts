/** Short, original lines for Today. Calm, practical, never preachy. */
export const LINES: string[] = [
  'Show up. That’s most of it.',
  'One good meal, one good set. Then the next.',
  'Slow progress is still progress.',
  'You don’t need a perfect day, just a decent one.',
  'Strength is built on the boring days.',
  'Eat like you plan to train tomorrow.',
  'Consistency beats intensity you can’t repeat.',
  'Today counts, even if it’s small.',
  'Rest is part of the programme.',
  'Protein first, then everything else.',
  'The weight will feel lighter in a few weeks.',
  'Good form now saves a lot of time later.',
  'You’ve done hard sessions before. This is another one.',
  'Missed a day? Pick it up at the next meal.',
  'Leave a rep in the tank and come back stronger.',
  'Small numbers add up to big changes.',
  'Water, sleep, protein. Keep it simple.',
  'Nobody gets fit in a week, and nobody needs to.',
  'Train for the person you’ll be in a year.',
  'A plan you follow beats a plan that’s perfect.',
  'Effort today, results later. That’s the deal.',
  'Progress hides until it doesn’t.',
  'Log it, lift it, let it add up.',
  'Be patient with the process and firm with the excuses.',
  'The first set is the hardest one to start.',
  'Warm up properly. Your joints will thank you.',
  'Your best lifts are still ahead of you.',
  'Fuel the work, then do the work.',
  'Calm and steady gets there.',
  'Add a little weight, or a rep, or a bit more care.',
  'What you do most days matters more than what you do some days.',
  'Recovery is where the strength shows up.',
  'Keep the streak honest, not perfect.',
  'A good week starts with one good meal.',
  'Finish the session you planned, not the one you feel like skipping.',
  'Quiet effort, done often.',
  'You don’t have to love every session. Just turn up for it.',
  'Strong is a habit.',
  'Eat enough to grow.',
  'Keep the bar moving.',
  'Today’s easy set was last month’s heavy one.',
  'Measure what matters, then let it guide you.',
  'Trust the reps you’ve already put in.',
  'Better than last time is enough.',
  'Don’t chase sore. Chase stronger.',
  'Push, pull, legs, repeat.',
  'Make the right choice the easy one.',
  'The plate on the bar and the plate on the table both count.',
];

// Stepping through the list by a stride that shares no factor with its length visits every line once
// before any repeats, and never shows the same line two days running.
const STRIDE = 17;

/** The line for a local day ("YYYY-MM-DD"): the same all day, a different one tomorrow. */
export function lineForDay(localDay: string): string {
  const [y, m, d] = localDay.split('-').map(Number);
  const dayNumber = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
  const n = LINES.length;
  return LINES[(((dayNumber * STRIDE) % n) + n) % n];
}
