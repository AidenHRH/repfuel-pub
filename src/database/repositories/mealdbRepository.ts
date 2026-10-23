import { getCommonFood } from '@/domain/commonFoods';
import { matchIngredients, type MealDbIngredient } from '@/domain/mealdbMatch';
import type { Recipe } from '@/domain/types';

import type { Db } from '../Db';

import { savePresetFood } from './foodRepository';
import { createRecipe, recipeNameTaken, type NewIngredient } from './recipeRepository';

/**
 * Saves a TheMealDB recipe to My meals: each ingredient matched to a built-in food comes across with its amount; the
 * rest are left for the owner to scan or pick. A name already in use gets " (2)", " (3)"….
 */
export async function saveMealDbRecipe(
  db: Db,
  meal: { name: string; ingredients: MealDbIngredient[] },
  portions: number,
): Promise<Recipe> {
  const ingredients: NewIngredient[] = [];
  for (const { foodId, grams } of matchIngredients(meal.ingredients).matched) {
    const preset = foodId ? getCommonFood(foodId) : null;
    if (!preset || grams <= 0) continue;
    const food = await savePresetFood(db, preset);
    ingredients.push({
      kind: 'food',
      foodId: food.id,
      amount: Math.round(grams * 10) / 10,
      unit: preset.basis === 'per_100ml' ? 'ml' : 'g',
    });
  }
  let name = meal.name;
  for (let n = 2; await recipeNameTaken(db, name); n++) name = `${meal.name} (${n})`;
  return createRecipe(db, { name, portionsMade: portions, ingredients, isFavourite: true });
}
