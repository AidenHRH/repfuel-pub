import { getCommonFood } from '@/domain/commonFoods';
import { getMealTemplate, MEAL_TEMPLATES, recipeTime, templateNutrients } from '@/domain/mealTemplates';

// The 26 meals from before full recipes: plans saved with them must not change.
const BEFORE: Record<string, [string, number][]> = {
  'porridge-banana': [
    ['oats', 50],
    ['semi-skimmed-milk', 250],
    ['banana', 118],
  ],
  'eggs-on-toast': [
    ['egg', 100],
    ['wholemeal-bread', 72],
    ['butter', 7],
  ],
  'yoghurt-berries-granola': [
    ['greek-yoghurt-0', 200],
    ['blueberries', 80],
    ['granola', 30],
  ],
  'pb-toast-banana': [
    ['wholemeal-bread', 72],
    ['peanut-butter', 16],
    ['banana', 118],
  ],
  'berry-oats': [
    ['oats', 50],
    ['blueberries', 80],
    ['chia-seeds', 12],
  ],
  'eggs-spinach-avocado': [
    ['egg', 150],
    ['spinach', 30],
    ['avocado', 68],
  ],
  'pb-rice-cakes-banana': [
    ['rice-cake', 27],
    ['peanut-butter', 16],
    ['banana', 118],
  ],
  'fruit-nut-bowl': [
    ['banana', 118],
    ['blueberries', 80],
    ['almonds', 30],
  ],
  'chicken-wrap': [
    ['tortilla-wrap', 62],
    ['chicken-breast', 100],
    ['hummus', 30],
    ['spinach', 30],
    ['tomato', 60],
  ],
  'tuna-jacket': [
    ['potato', 200],
    ['tuna-can', 110],
    ['sweetcorn', 80],
  ],
  'eggs-avocado-toast': [
    ['egg', 100],
    ['avocado', 68],
    ['wholemeal-bread', 72],
  ],
  'chickpea-salad': [
    ['chickpeas', 120],
    ['tomato', 100],
    ['cucumber', 80],
    ['red-pepper', 60],
    ['olive-oil', 7],
  ],
  'hummus-veg-wrap': [
    ['tortilla-wrap', 62],
    ['hummus', 60],
    ['red-pepper', 60],
    ['spinach', 30],
    ['carrot', 61],
  ],
  'lentil-salad': [
    ['lentils', 198],
    ['tomato', 100],
    ['cucumber', 80],
    ['avocado', 68],
    ['olive-oil', 7],
  ],
  'salmon-rice-broccoli': [
    ['salmon', 120],
    ['brown-rice', 180],
    ['broccoli', 90],
  ],
  'chicken-sweet-potato': [
    ['chicken-breast', 150],
    ['sweet-potato', 200],
    ['peas', 80],
  ],
  'chicken-pasta': [
    ['pasta', 200],
    ['chicken-breast', 120],
    ['tomato', 100],
    ['olive-oil', 7],
  ],
  'prawn-stir-fry': [
    ['prawns', 120],
    ['white-rice', 158],
    ['red-pepper', 100],
    ['broccoli', 90],
    ['olive-oil', 7],
  ],
  'lentil-curry': [
    ['lentils', 200],
    ['white-rice', 158],
    ['spinach', 30],
    ['onion', 55],
    ['olive-oil', 7],
  ],
  'chickpea-curry': [
    ['chickpeas', 120],
    ['sweet-potato', 150],
    ['spinach', 30],
    ['white-rice', 158],
    ['olive-oil', 7],
  ],
  'apple-pb': [
    ['apple', 182],
    ['peanut-butter', 16],
  ],
  'yoghurt-honey': [
    ['greek-yoghurt-0', 170],
    ['honey', 7],
  ],
  almonds: [['almonds', 30]],
  'cottage-rice-cakes': [
    ['cottage-cheese', 113],
    ['rice-cake', 18],
  ],
  banana: [['banana', 118]],
};

test('every ingredient is a built-in food, and every step uses that recipe’s own ingredients', () => {
  for (const t of MEAL_TEMPLATES) {
    const foods = new Set(t.ingredients.map((i) => i.food));
    for (const i of t.ingredients) expect([t.id, getCommonFood(i.food)?.id]).toEqual([t.id, i.food]);
    for (const s of t.steps) for (const u of s.uses) expect([t.id, foods.has(u)]).toEqual([t.id, true]);
  }
});

test('every meal has steps, times and how many it serves', () => {
  expect(MEAL_TEMPLATES.length).toBeGreaterThanOrEqual(40);
  for (const t of MEAL_TEMPLATES) {
    expect([t.id, t.serves >= 1]).toEqual([t.id, true]);
    expect([t.id, t.steps.length >= (t.slot === 'snack' ? 1 : 3)]).toEqual([t.id, true]);
    if (t.slot !== 'snack') expect([t.id, t.prepMin + t.cookMin > 0]).toEqual([t.id, true]);
  }
});

test('the meals from before keep their ingredients and grams', () => {
  for (const [id, ingredients] of Object.entries(BEFORE)) {
    expect([id, getMealTemplate(id)?.ingredients.map((i) => [i.food, i.grams])]).toEqual([id, ingredients]);
  }
});

test('new meal-prep dishes, with sensible numbers', () => {
  const chilli = getMealTemplate('turkey-chilli')!;
  expect(chilli.slot).toBe('dinner');
  const kcal = templateNutrients(chilli).kcal!;
  expect(kcal).toBeGreaterThan(350);
  expect(kcal).toBeLessThan(750);
  expect(recipeTime(chilli)).toMatch(/^\d+ min prep · \d+ min cook$/);
  for (const id of ['chicken-rice-veg', 'salmon-couscous', 'tuna-pasta-bake', 'protein-overnight-oats']) {
    expect(getMealTemplate(id)).not.toBeNull();
  }
});
