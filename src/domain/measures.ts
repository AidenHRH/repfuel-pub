import { friendlyNumber } from './format';
import { getCommonFood, type Measure } from './commonFoods';
import { drinkMeasures, isDrink } from './drinks';
import type { NutritionBasis } from './types';

type Measurable = { basis: NutritionBasis; servingSize: number | null; presetId: string | null; packSize: number | null };

// Like "1 serving" and "1 can", so How many reads "0.5 × 1 pack".
const ONE_PACK = '1 pack';

/**
 * The sizes offered for a food weighed in g or ml: a built-in food's own measures (a cup, a large egg), a drink's
 * sizes, or the pack's serving; then the whole pack when its size is known and not already listed. Per-serving foods
 * are counted in servings, so they have none.
 */
export function foodMeasures(food: Measurable): Measure[] {
  if (food.basis === 'per_serving') return [];
  const preset = food.presetId ? getCommonFood(food.presetId) : null;
  const sizes: Measure[] = isDrink(food)
    ? drinkMeasures(food)
    : preset
      ? preset.measures
      : food.servingSize
        ? [{ label: '1 serving', grams: food.servingSize }]
        : [];
  const pack = food.packSize;
  return pack && !sizes.some((m) => m.grams === pack) ? [...sizes, { label: ONE_PACK, grams: pack }] : sizes;
}

/** "150 g of a 300 g pack", when the pack size is known. */
export function packHint(amount: number, packSize: number | null, unit: 'g' | 'ml'): string | null {
  return packSize ? `${friendlyNumber(amount)} ${unit} of a ${friendlyNumber(packSize)} ${unit} pack` : null;
}
