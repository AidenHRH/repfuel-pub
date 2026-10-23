/**
 * Parses a typed amount. Accepts a comma or dot decimal ("12,5" → 12.5).
 * Blank → null (unknown). Anything else that isn't a plain non-negative number → NaN,
 * so forms can tell "left blank" from "typed something wrong" and never store it as 0.
 */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(',', '.'));
}

/**
 * Parses a typed duration: plain seconds ("90") or minutes:seconds ("1:30", "1:5" = 65 s).
 * Blank → null. Zero, seconds of 60 or more after a colon, or anything else → NaN.
 */
export function parseDuration(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const m = /^(?:(\d{1,3}):)?(\d{1,4})$/.exec(trimmed);
  if (!m) return Number.NaN;
  const minutes = m[1] === undefined ? 0 : Number(m[1]);
  const seconds = Number(m[2]);
  if (m[1] !== undefined && seconds >= 60) return Number.NaN;
  const total = minutes * 60 + seconds;
  return total > 0 ? total : Number.NaN;
}
