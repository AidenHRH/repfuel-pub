import { roundForDisplay } from './nutrition';
import type { LogUnit, Nutrients } from './types';

const FRACTIONS: Record<string, string> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
  '1.25': '1¼',
  '1.5': '1½',
  '1.75': '1¾',
  '2.5': '2½',
};

export function friendlyNumber(n: number): string {
  return FRACTIONS[String(n)] ?? String(Math.round(n * 100) / 100);
}

const QUARTERS = ['', '¼', '½', '¾'];

/** A count of portions with quarters as fractions: 4.5 → "4½", 0.75 → "¾", 6 → "6"; anything else up to 2 decimals. */
export function portionCount(n: number): string {
  const whole = Math.floor(n);
  const quarters = (n - whole) * 4;
  if (!Number.isInteger(Math.round(quarters * 1000) / 1000)) return String(Math.round(n * 100) / 100);
  return `${whole === 0 && quarters ? '' : whole}${QUARTERS[Math.round(quarters)]}`;
}

/** "1 portion", "½ portion", "2 servings", "250 g". */
export function amountLabel(amount: number, unit: LogUnit): string {
  if (unit === 'g' || unit === 'ml') return `${friendlyNumber(amount)} ${unit}`;
  const plural = amount > 1;
  return `${friendlyNumber(amount)} ${unit}${plural ? 's' : ''}`;
}

/** "≈ 650 kcal" or "404 kcal"; unknown → "— kcal". */
export function kcalLabel(n: Nutrients, approximate: boolean): string {
  return `${approximate && n.kcal !== null ? '≈ ' : ''}${roundForDisplay(n.kcal, 'kcal')} kcal`;
}

export function proteinLabel(n: Nutrients): string {
  return `${roundForDisplay(n.proteinG, 'g')} g protein`;
}
