import { calculateLogged } from './nutrition';
import type { FoodProduct, Nutrients, Recipe } from './types';

export type RecipeLookup = {
  recipe(id: string): Recipe | undefined;
  food(id: string): FoodProduct | undefined;
};

const KEYS = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fibreG'] as const;

/** False when a food was re-labelled (e.g. per serving → per 100 g) after the recipe was made. */
function unitFits(food: FoodProduct, unit: 'g' | 'ml' | 'serving'): boolean {
  return food.basis === 'per_serving' ? unit === 'serving' : food.basis === 'per_100g' ? unit === 'g' : unit === 'ml';
}

const UNKNOWN: Nutrients = { kcal: null, proteinG: null, carbsG: null, fatG: null, fibreG: null };

function addInto(total: Nutrients, part: Nutrients, factor = 1) {
  for (const key of KEYS) {
    const a = total[key];
    const b = part[key];
    total[key] = a === null || b === null ? null : a + b * factor;
  }
}

/**
 * Nutrients for one portion of a recipe. A food ingredient contributes its logged amount;
 * a batch-recipe ingredient contributes its per-portion nutrients × portions used.
 * Any unknown value makes that nutrient unknown; a missing ingredient makes all of them unknown.
 */
export function recipePortionNutrients(
  recipeId: string,
  lookup: RecipeLookup,
  visiting: ReadonlySet<string> = new Set(),
): { nutrients: Nutrients; isApproximate: boolean } {
  if (visiting.has(recipeId)) throw new Error('Recipe contains itself');
  const recipe = lookup.recipe(recipeId);
  if (!recipe) return { nutrients: { ...UNKNOWN }, isApproximate: false };

  const path = new Set(visiting).add(recipeId);
  const total: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 };
  let isApproximate = false;

  for (const ingredient of recipe.ingredients) {
    if (ingredient.kind === 'food') {
      const food = lookup.food(ingredient.foodId);
      if (!food || !unitFits(food, ingredient.unit)) return { nutrients: { ...UNKNOWN }, isApproximate };
      if (food.dataSource === 'user_approximate') isApproximate = true;
      const amount =
        ingredient.unit === 'serving' ? { servings: ingredient.amount } : { quantity: ingredient.amount, unit: ingredient.unit };
      addInto(total, calculateLogged(food.nutrients, food.basis, amount));
    } else {
      if (!lookup.recipe(ingredient.subRecipeId)) return { nutrients: { ...UNKNOWN }, isApproximate };
      const sub = recipePortionNutrients(ingredient.subRecipeId, lookup, path);
      if (sub.isApproximate) isApproximate = true;
      addInto(total, sub.nutrients, ingredient.portions);
    }
  }

  const perPortion: Nutrients = { ...UNKNOWN };
  for (const key of KEYS) {
    const value = total[key];
    perPortion[key] = value === null ? null : value / recipe.portionsMade;
  }
  return { nutrients: perPortion, isApproximate };
}

/** True if giving `recipeId` these recipe ingredients would make it contain itself. */
export function findCycle(recipeId: string, ingredientRecipeIds: string[], lookup: RecipeLookup): boolean {
  const seen = new Set<string>();
  const stack = [...ingredientRecipeIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === recipeId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const ing of lookup.recipe(id)?.ingredients ?? []) {
      if (ing.kind === 'recipe') stack.push(ing.subRecipeId);
    }
  }
  return false;
}
