/**
 * How healthy a packaged product is, from Open Food Facts: its Nutri-Score (A best to E worst), how processed it
 * is (NOVA 1–4) and its additives. Like Yuka, but every part of the verdict is shown and explained.
 */
export type NutriScore = 'a' | 'b' | 'c' | 'd' | 'e';
export type Nova = 1 | 2 | 3 | 4;
export type HealthInfo = { nutriscore: NutriScore | null; nova: Nova | null; additives: string[] };
export type Verdict = 'good' | 'okay' | 'poor';

export const NOVA_LABELS: Record<Nova, string> = {
  1: 'Unprocessed or minimally processed',
  2: 'Processed culinary ingredient',
  3: 'Processed',
  4: 'Ultra-processed',
};

const NUTRISCORE_LABELS: Record<NutriScore, string> = {
  a: 'a good nutritional balance',
  b: 'a fairly good nutritional balance',
  c: 'an average nutritional balance',
  d: 'a poor nutritional balance',
  e: 'a bad nutritional balance',
};

export const VERDICT_LABELS: Record<Verdict, string> = { good: 'Good', okay: 'Okay', poor: 'Poor' };

const STEP: Record<NutriScore, number> = { a: 0, b: 0, c: 1, d: 2, e: 2 };
const VERDICTS: Verdict[] = ['good', 'okay', 'poor'];

/**
 * Good / Okay / Poor from the Nutri-Score (A–B good, C okay, D–E poor), one step worse when ultra-processed.
 * Null without a Nutri-Score: there's not enough to judge.
 */
export function healthVerdict(info: HealthInfo): { verdict: Verdict; reasons: string[] } | null {
  if (!info.nutriscore) return null;
  const step = Math.min(2, STEP[info.nutriscore] + (info.nova === 4 ? 1 : 0));
  const reasons = [`Nutri-Score ${info.nutriscore.toUpperCase()}: ${NUTRISCORE_LABELS[info.nutriscore]}`];
  if (info.nova) reasons.push(`${NOVA_LABELS[info.nova]} (NOVA ${info.nova})`);
  if (info.additives.length) reasons.push(`${info.additives.length} additive${info.additives.length === 1 ? '' : 's'}`);
  return { verdict: VERDICTS[step], reasons };
}

/** "en:e322i" → "E322i"; anything that isn't an E-number tag → null. */
export function additiveCode(tag: string): string | null {
  const m = /^[a-z]{2}:e(\d{3,4}[a-z]?)$/i.exec(tag.trim());
  return m ? `E${m[1].toLowerCase()}` : null;
}
