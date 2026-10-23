/** Effort 1–10 as a slider: where the thumb is, and how strongly it answers back. */

const LEVELS = 10;

/** The level under a thumb `x` points along a row `width` wide (1 at the left, 10 at the right). */
export function levelAt(x: number, width: number): number {
  if (width <= 0) return 1;
  return Math.min(LEVELS, Math.max(1, Math.floor((x / width) * LEVELS) + 1));
}

/** The haptic tick for a level: light when easy, heavy near the limit. */
export function effortHaptic(level: number): 'light' | 'medium' | 'heavy' {
  return level >= 8 ? 'heavy' : level >= 4 ? 'medium' : 'light';
}

/** How far the bars shake (points) when a level is chosen: none up to 4, up to 4 at 10. */
export function effortShake(level: number): number {
  return level <= 4 ? 0 : Math.round(((level - 4) / 6) * 4 * 10) / 10;
}
