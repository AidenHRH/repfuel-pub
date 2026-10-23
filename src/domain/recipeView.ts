import { getCommonFood } from './commonFoods';
import { friendlyNumber } from './format';
import type { MealTemplate } from './mealTemplates';

export type IngredientLine = { food: string; name: string; amount: string; note: string | null };

/** "500 g", "14 g", "3.5 g": whole grams from 10 g, halves below. */
function amountText(total: number, unit: string): string {
  const rounded = total >= 10 ? Math.round(total) : Math.round(total * 2) / 2;
  return `${friendlyNumber(rounded)} ${unit}`;
}

/** A recipe's ingredients for this many portions, by name ("Turkey mince 5% fat, raw", "500 g", "chopped"). */
export function ingredientLines(t: Pick<MealTemplate, 'ingredients'>, portions: number): IngredientLine[] {
  return t.ingredients.map((i) => {
    const food = getCommonFood(i.food);
    return {
      food: i.food,
      name: food?.name ?? i.food,
      amount: amountText(i.grams * portions, food?.basis === 'per_100ml' ? 'ml' : 'g'),
      note: i.note ?? null,
    };
  });
}
