import type { Nutrients, NutritionBasis } from './types';

const KEYS = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fibreG', 'sugarG'] as const;
type NutrientKey = (typeof KEYS)[number];

export type LoggedAmount = { servings: number } | { quantity: number; unit: 'g' | 'ml' };

function scale(nutrients: Nutrients, factor: number): Nutrients {
  const out = {} as Nutrients;
  for (const key of KEYS) {
    // A nutrient the input never had (older snapshots have no sugar) stays absent.
    if (nutrients[key] === undefined) continue;
    const value = nutrients[key];
    out[key] = value === null ? null : value * factor;
  }
  return out;
}

/**
 * Nutrients for the amount eaten.
 * Per serving: value × servings. Per 100 g/ml: value × quantity ÷ 100.
 */
export function calculateLogged(nutrients: Nutrients, basis: NutritionBasis, amount: LoggedAmount): Nutrients {
  const size = 'servings' in amount ? amount.servings : amount.quantity;
  if (!Number.isFinite(size) || size < 0) throw new RangeError(`Amount must be a non-negative number, got ${size}`);

  if (basis === 'per_serving') {
    if (!('servings' in amount)) throw new RangeError('Per-serving foods are logged in servings');
    return scale(nutrients, amount.servings);
  }

  const expectedUnit = basis === 'per_100g' ? 'g' : 'ml';
  if (!('unit' in amount) || amount.unit !== expectedUnit) {
    throw new RangeError(`This food is measured per 100 ${expectedUnit}; log it in ${expectedUnit}`);
  }
  return scale(nutrients, amount.quantity / 100);
}

export type DayTotals = {
  totals: Record<NutrientKey, number>;
  /** True when at least one entry's value for that nutrient is unknown. */
  incomplete: Record<NutrientKey, boolean>;
  /** True when at least one entry's value for that nutrient is known (secondary nutrients show only then). */
  known: Record<NutrientKey, boolean>;
  /** True when at least one entry is the owner's own estimate. */
  approximate: boolean;
};

/** Sums stored entry values at full precision. Round only for display. */
export function sumEntries(entries: (Nutrients & { isApproximate: boolean })[]): DayTotals {
  const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0, sugarG: 0 };
  const incomplete = { kcal: false, proteinG: false, carbsG: false, fatG: false, fibreG: false, sugarG: false };
  const known = { kcal: false, proteinG: false, carbsG: false, fatG: false, fibreG: false, sugarG: false };
  let approximate = false;

  for (const entry of entries) {
    if (entry.isApproximate) approximate = true;
    for (const key of KEYS) {
      const value = entry[key] ?? null;
      if (value === null) incomplete[key] = true;
      else {
        totals[key] += value;
        known[key] = true;
      }
    }
  }

  return { totals, incomplete, known, approximate };
}

const wholeNumber = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** Display string for a nutrient amount; unknown values show as a dash. */
export function roundForDisplay(value: number | null, _unit: 'kcal' | 'g'): string {
  if (value === null) return '—';
  return wholeNumber.format(Math.round(value));
}
