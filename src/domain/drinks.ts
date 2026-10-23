import { getCommonFood, type Measure } from './commonFoods';
import type { NutritionBasis } from './types';

/** Sizes for a drink that doesn't give its own. */
export const DRINK_SIZES: Measure[] = [
  { label: '1 can', grams: 330 },
  { label: '1 glass', grams: 250 },
  { label: '1 bottle', grams: 500 },
];

/** A drink is anything sold by volume, or one of the built-in drinks (a latte, a cola). */
export function isDrink(food: { basis: NutritionBasis; presetId: string | null }): boolean {
  return food.basis === 'per_100ml' || (food.presetId ? getCommonFood(food.presetId)?.group === 'Drinks' : false);
}

/** How a drink can be measured: a built-in drink's own sizes; else the product's serving, then can, glass, bottle. */
export function drinkMeasures(food: { servingSize: number | null; presetId: string | null }): Measure[] {
  const preset = food.presetId ? getCommonFood(food.presetId) : null;
  if (preset) return preset.measures;
  return [...(food.servingSize ? [{ label: '1 serving', grams: food.servingSize }] : []), ...DRINK_SIZES];
}
