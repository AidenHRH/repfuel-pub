import type { FoodProduct, Nutrients, NutritionBasis, Recipe, RecipeIngredient } from '@/domain/types';

const now = '2026-10-21T12:00:00.000Z';

export function food(id: string, basis: NutritionBasis, n: Partial<Nutrients>, extra: Partial<FoodProduct> = {}): FoodProduct {
  return {
    id,
    name: id,
    brand: null,
    barcode: null,
    basis,
    servingSize: null,
    servingUnit: null,
    packSize: null,
    nutrients: { kcal: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, ...n },
    dataSource: 'manual',
    isFavourite: false,
    notes: null,
    imageUrl: null,
    presetId: null,
    health: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

type IngredientSpec =
  | { kind: 'food'; foodId: string; amount: number; unit: 'g' | 'ml' | 'serving' }
  | { kind: 'recipe'; subRecipeId: string; portions: number };

export function recipe(id: string, portionsMade: number, ingredients: IngredientSpec[]): Recipe {
  return {
    id,
    name: id,
    portionsMade,
    notes: null,
    isFavourite: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ingredients: ingredients.map((spec, i) => ({ id: `${id}-${i}`, recipeId: id, sortOrder: i, ...spec }) as RecipeIngredient),
  };
}

// Real-world style label values used across tests (per 100 g/ml unless per serving).
export const oats = food('oats', 'per_100g', { kcal: 379, proteinG: 13.2, carbsG: 60, fatG: 7, fibreG: 10 });
export const milk = food('milk', 'per_100ml', { kcal: 47, proteinG: 3.4, carbsG: 4.7, fatG: 1.7, fibreG: 0 });
export const whey = food('whey', 'per_serving', { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5, fibreG: null });
export const picoMix = food('pico-mix', 'per_serving', { kcal: 120, proteinG: 4, carbsG: 20, fatG: 2, fibreG: 4 });
export const sweetPotato = food('sweet-potato', 'per_100g', { kcal: 86, proteinG: 1.6, carbsG: 20.1, fatG: 0.1, fibreG: 3 });
export const beef = food('beef', 'per_100g', { kcal: 137, proteinG: 21.4, carbsG: 0, fatG: 5, fibreG: 0 });

export const overnightOats = recipe('overnight-oats', 1, [
  { kind: 'food', foodId: 'oats', amount: 50, unit: 'g' },
  { kind: 'food', foodId: 'milk', amount: 200, unit: 'ml' },
  { kind: 'food', foodId: 'whey', amount: 1, unit: 'serving' },
]);
export const pico = recipe('pico', 4, [{ kind: 'food', foodId: 'pico-mix', amount: 1, unit: 'serving' }]);
export const beefDinner = (picoPortions: number) =>
  recipe('beef-dinner', 1, [
    { kind: 'food', foodId: 'sweet-potato', amount: 250, unit: 'g' },
    { kind: 'food', foodId: 'beef', amount: 150, unit: 'g' },
    { kind: 'recipe', subRecipeId: 'pico', portions: picoPortions },
  ]);

export function lookupOf(foods: FoodProduct[], recipes: Recipe[]) {
  const f = new Map(foods.map((x) => [x.id, x]));
  const r = new Map(recipes.map((x) => [x.id, x]));
  return { food: (id: string) => f.get(id), recipe: (id: string) => r.get(id) };
}
