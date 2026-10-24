import { DETAILS, PREP_RECIPES } from '@/data/recipeBook';

import { getCommonFood } from './commonFoods';
import { CONTAINS, type DietTag } from './diet';
import type { Nutrients } from './types';

export type PlanSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** One step of a recipe: what to do, how long, and the ingredients (food ids) it handles. */
export type RecipeStep = { text: string; uses: string[]; minutes?: number };

/** How to make a meal: times, how many portions the method makes, the steps, and how each ingredient is prepared. */
export type RecipeDetails = {
  prepMin: number;
  cookMin: number;
  serves: number;
  steps: RecipeStep[];
  notes?: Record<string, string>;
};

/**
 * A recipe from RepFuel's recipe book, made of common foods (grams per portion), for meal plans and the recipe
 * screen.
 */
export type MealTemplate = Omit<BaseTemplate, 'ingredients'> &
  Omit<RecipeDetails, 'notes'> & { ingredients: { food: string; grams: number; note?: string }[] };

type BaseTemplate = {
  id: string;
  name: string;
  slot: PlanSlot;
  /**
   * How it's meal-prepped: `box` is cooked ahead and packed whole; `parts` has its cooked parts made ahead and is
   * put together on the day (a wrap goes soggy); `fresh` is made on the day.
   */
  prep: 'box' | 'parts' | 'fresh';
  ingredients: { food: string; grams: number }[];
};

/** The simple meals RepFuel has always planned; their steps and times are in the recipe book. */
const SIMPLE_MEALS: BaseTemplate[] = [
  // Breakfast
  {
    id: 'porridge-banana',
    name: 'Porridge with banana',
    slot: 'breakfast',
    prep: 'fresh',
    ingredients: [
      { food: 'oats', grams: 50 },
      { food: 'semi-skimmed-milk', grams: 250 },
      { food: 'banana', grams: 118 },
    ],
  },
  {
    id: 'eggs-on-toast',
    name: 'Eggs on toast',
    slot: 'breakfast',
    prep: 'fresh',
    ingredients: [
      { food: 'egg', grams: 100 },
      { food: 'wholemeal-bread', grams: 72 },
      { food: 'butter', grams: 7 },
    ],
  },
  {
    id: 'yoghurt-berries-granola',
    name: 'Greek yoghurt, berries & granola',
    slot: 'breakfast',
    prep: 'fresh',
    ingredients: [
      { food: 'greek-yoghurt-0', grams: 200 },
      { food: 'blueberries', grams: 80 },
      { food: 'granola', grams: 30 },
    ],
  },
  {
    id: 'pb-toast-banana',
    name: 'Peanut butter toast & banana',
    slot: 'breakfast',
    prep: 'fresh',
    ingredients: [
      { food: 'wholemeal-bread', grams: 72 },
      { food: 'peanut-butter', grams: 16 },
      { food: 'banana', grams: 118 },
    ],
  },
  {
    id: 'berry-oats',
    name: 'Berry oats with chia',
    slot: 'breakfast',
    prep: 'fresh',
    ingredients: [
      { food: 'oats', grams: 50 },
      { food: 'blueberries', grams: 80 },
      { food: 'chia-seeds', grams: 12 },
    ],
  },
  {
    id: 'eggs-spinach-avocado',
    name: 'Scrambled eggs, spinach & avocado',
    slot: 'breakfast',
    prep: 'fresh',
    ingredients: [
      { food: 'egg', grams: 150 },
      { food: 'spinach', grams: 30 },
      { food: 'avocado', grams: 68 },
    ],
  },
  {
    id: 'pb-rice-cakes-banana',
    name: 'Peanut butter rice cakes & banana',
    slot: 'breakfast',
    prep: 'fresh',
    ingredients: [
      { food: 'rice-cake', grams: 27 },
      { food: 'peanut-butter', grams: 16 },
      { food: 'banana', grams: 118 },
    ],
  },
  {
    id: 'fruit-nut-bowl',
    name: 'Fruit & almond bowl',
    slot: 'breakfast',
    prep: 'fresh',
    ingredients: [
      { food: 'banana', grams: 118 },
      { food: 'blueberries', grams: 80 },
      { food: 'almonds', grams: 30 },
    ],
  },
  // Lunch
  {
    id: 'chicken-wrap',
    name: 'Chicken & hummus wrap',
    slot: 'lunch',
    prep: 'parts',
    ingredients: [
      { food: 'tortilla-wrap', grams: 62 },
      { food: 'chicken-breast', grams: 100 },
      { food: 'hummus', grams: 30 },
      { food: 'spinach', grams: 30 },
      { food: 'tomato', grams: 60 },
    ],
  },
  {
    id: 'tuna-jacket',
    name: 'Tuna & sweetcorn jacket potato',
    slot: 'lunch',
    prep: 'box',
    ingredients: [
      { food: 'potato', grams: 200 },
      { food: 'tuna-can', grams: 110 },
      { food: 'sweetcorn', grams: 80 },
    ],
  },
  {
    id: 'eggs-avocado-toast',
    name: 'Eggs & avocado on toast',
    slot: 'lunch',
    prep: 'fresh',
    ingredients: [
      { food: 'egg', grams: 100 },
      { food: 'avocado', grams: 68 },
      { food: 'wholemeal-bread', grams: 72 },
    ],
  },
  {
    id: 'chickpea-salad',
    name: 'Chickpea salad',
    slot: 'lunch',
    prep: 'box',
    ingredients: [
      { food: 'chickpeas', grams: 120 },
      { food: 'tomato', grams: 100 },
      { food: 'cucumber', grams: 80 },
      { food: 'red-pepper', grams: 60 },
      { food: 'olive-oil', grams: 7 },
    ],
  },
  {
    id: 'hummus-veg-wrap',
    name: 'Hummus & veg wrap',
    slot: 'lunch',
    prep: 'parts',
    ingredients: [
      { food: 'tortilla-wrap', grams: 62 },
      { food: 'hummus', grams: 60 },
      { food: 'red-pepper', grams: 60 },
      { food: 'spinach', grams: 30 },
      { food: 'carrot', grams: 61 },
    ],
  },
  {
    id: 'lentil-salad',
    name: 'Lentil & avocado salad',
    slot: 'lunch',
    prep: 'parts',
    ingredients: [
      { food: 'lentils', grams: 198 },
      { food: 'tomato', grams: 100 },
      { food: 'cucumber', grams: 80 },
      { food: 'avocado', grams: 68 },
      { food: 'olive-oil', grams: 7 },
    ],
  },
  // Dinner
  {
    id: 'salmon-rice-broccoli',
    name: 'Salmon, rice & broccoli',
    slot: 'dinner',
    prep: 'box',
    ingredients: [
      { food: 'salmon', grams: 120 },
      { food: 'brown-rice', grams: 180 },
      { food: 'broccoli', grams: 90 },
    ],
  },
  {
    id: 'chicken-sweet-potato',
    name: 'Chicken, sweet potato & peas',
    slot: 'dinner',
    prep: 'box',
    ingredients: [
      { food: 'chicken-breast', grams: 150 },
      { food: 'sweet-potato', grams: 200 },
      { food: 'peas', grams: 80 },
    ],
  },
  {
    id: 'chicken-pasta',
    name: 'Chicken & tomato pasta',
    slot: 'dinner',
    prep: 'box',
    ingredients: [
      { food: 'pasta', grams: 200 },
      { food: 'chicken-breast', grams: 120 },
      { food: 'tomato', grams: 100 },
      { food: 'olive-oil', grams: 7 },
    ],
  },
  {
    id: 'prawn-stir-fry',
    name: 'Prawn stir-fry with rice',
    slot: 'dinner',
    prep: 'box',
    ingredients: [
      { food: 'prawns', grams: 120 },
      { food: 'white-rice', grams: 158 },
      { food: 'red-pepper', grams: 100 },
      { food: 'broccoli', grams: 90 },
      { food: 'olive-oil', grams: 7 },
    ],
  },
  {
    id: 'lentil-curry',
    name: 'Lentil & spinach curry with rice',
    slot: 'dinner',
    prep: 'box',
    ingredients: [
      { food: 'lentils', grams: 200 },
      { food: 'white-rice', grams: 158 },
      { food: 'spinach', grams: 30 },
      { food: 'onion', grams: 55 },
      { food: 'olive-oil', grams: 7 },
    ],
  },
  {
    id: 'chickpea-curry',
    name: 'Chickpea & sweet potato curry',
    slot: 'dinner',
    prep: 'box',
    ingredients: [
      { food: 'chickpeas', grams: 120 },
      { food: 'sweet-potato', grams: 150 },
      { food: 'spinach', grams: 30 },
      { food: 'white-rice', grams: 158 },
      { food: 'olive-oil', grams: 7 },
    ],
  },
  // Snacks
  {
    id: 'apple-pb',
    name: 'Apple & peanut butter',
    slot: 'snack',
    prep: 'fresh',
    ingredients: [
      { food: 'apple', grams: 182 },
      { food: 'peanut-butter', grams: 16 },
    ],
  },
  {
    id: 'yoghurt-honey',
    name: 'Greek yoghurt & honey',
    slot: 'snack',
    prep: 'fresh',
    ingredients: [
      { food: 'greek-yoghurt-0', grams: 170 },
      { food: 'honey', grams: 7 },
    ],
  },
  { id: 'almonds', name: 'Handful of almonds', slot: 'snack', prep: 'fresh', ingredients: [{ food: 'almonds', grams: 30 }] },
  {
    id: 'cottage-rice-cakes',
    name: 'Cottage cheese on rice cakes',
    slot: 'snack',
    prep: 'fresh',
    ingredients: [
      { food: 'cottage-cheese', grams: 113 },
      { food: 'rice-cake', grams: 18 },
    ],
  },
  { id: 'banana', name: 'Banana', slot: 'snack', prep: 'fresh', ingredients: [{ food: 'banana', grams: 118 }] },
];

export const MEAL_TEMPLATES: MealTemplate[] = [
  ...SIMPLE_MEALS.map((t): MealTemplate => {
    const { notes = {}, ...details } = DETAILS[t.id];
    return {
      ...t,
      ...details,
      ingredients: t.ingredients.map((i) => ({ ...i, ...(notes[i.food] ? { note: notes[i.food] } : {}) })),
    };
  }),
  ...PREP_RECIPES,
];

const byId = new Map(MEAL_TEMPLATES.map((t) => [t.id, t]));

/** "10 min prep · 25 min cook" (or just one when the other is none). */
export function recipeTime(t: Pick<MealTemplate, 'prepMin' | 'cookMin'>): string {
  const parts = [t.prepMin ? `${t.prepMin} min prep` : null, t.cookMin ? `${t.cookMin} min cook` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No cooking';
}

export function getMealTemplate(id: string): MealTemplate | null {
  return byId.get(id) ?? null;
}

/** A template's nutrition for one portion (all its ingredients). */
export function templateNutrients(t: MealTemplate): Nutrients {
  const total: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 };
  for (const { food, grams } of t.ingredients) {
    const f = getCommonFood(food);
    if (!f) throw new Error(`Unknown common food: ${food}`);
    for (const key of Object.keys(total) as (keyof Nutrients)[]) {
      const v = f.per100[key] ?? null;
      total[key] = total[key] === null || v === null ? null : total[key]! + (v * grams) / 100;
    }
  }
  return total;
}

/** Everything a template contains that a diet might avoid. */
export function templateTags(t: MealTemplate): Set<DietTag> {
  return new Set(t.ingredients.flatMap(({ food }) => CONTAINS[food] ?? []));
}
