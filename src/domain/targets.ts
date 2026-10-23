import { parseAmount } from './parse';

/** Reads a target, treating "2,500" as two thousand five hundred (a decimal comma never appears in a target). */
function parseTarget(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d{1,3}(,\d{3})+$/.test(trimmed)) return Number(trimmed.replace(/,/g, ''));
  return parseAmount(trimmed);
}

export type TargetsResult = { ok: true; caloriesKcal: number; proteinGrams: number } | { ok: false };

/** Daily targets within sensible bounds: 1–10,000 kcal and 1–1,000 g protein. */
export function validateTargets(kcalText: string, proteinText: string): TargetsResult {
  const kcal = parseTarget(kcalText);
  const protein = parseTarget(proteinText);
  const inRange = (n: number | null, max: number): n is number => n !== null && Number.isFinite(n) && n >= 1 && n <= max;
  if (!inRange(kcal, 10_000) || !inRange(protein, 1_000)) return { ok: false };
  return { ok: true, caloriesKcal: kcal, proteinGrams: protein };
}
