import { findCycle, recipePortionNutrients } from '@/domain/recipes';

import {
  beef,
  beefDinner,
  food,
  lookupOf,
  milk,
  oats,
  overnightOats,
  pico,
  picoMix,
  recipe,
  sweetPotato,
  whey,
} from '../helpers/foods';

const allFoods = [oats, milk, whey, picoMix, sweetPotato, beef];

describe('recipePortionNutrients', () => {
  test('overnight oats: per-100 g, per-100 ml and per-serving ingredients add up', () => {
    const { nutrients, isApproximate } = recipePortionNutrients('overnight-oats', lookupOf(allFoods, [overnightOats]));
    expect(nutrients.kcal).toBeCloseTo(403.5, 10);
    expect(nutrients.proteinG).toBeCloseTo(37.4, 10);
    expect(isApproximate).toBe(false);
  });

  test('a batch divides by the portions it makes', () => {
    const { nutrients } = recipePortionNutrients('pico', lookupOf(allFoods, [pico]));
    expect(nutrients.kcal).toBeCloseTo(30, 10);
    expect(nutrients.proteinG).toBeCloseTo(1, 10);
  });

  test('a meal can take a share of a batch recipe', () => {
    const lookup = lookupOf(allFoods, [pico, beefDinner(1)]);
    const { nutrients } = recipePortionNutrients('beef-dinner', lookup);
    expect(nutrients.kcal).toBeCloseTo(450.5, 10);
    expect(nutrients.proteinG).toBeCloseTo(37.1, 10);
  });

  test('half a portion of the batch counts half', () => {
    const { nutrients } = recipePortionNutrients('beef-dinner', lookupOf(allFoods, [pico, beefDinner(0.5)]));
    expect(nutrients.kcal).toBeCloseTo(435.5, 10);
  });

  test('an unknown nutrient in any ingredient makes that nutrient unknown', () => {
    const { nutrients } = recipePortionNutrients('overnight-oats', lookupOf(allFoods, [overnightOats]));
    expect(nutrients.fibreG).toBeNull();
    expect(nutrients.fatG).not.toBeNull();
  });

  test('an approximate ingredient makes the recipe approximate, even through a batch', () => {
    const roughPico = food('pico-mix', 'per_serving', { kcal: 120, proteinG: 4 }, { dataSource: 'user_approximate' });
    const { isApproximate } = recipePortionNutrients('beef-dinner', lookupOf([sweetPotato, beef, roughPico], [pico, beefDinner(1)]));
    expect(isApproximate).toBe(true);
  });

  test('a missing ingredient makes every nutrient unknown rather than silently dropping it', () => {
    const { nutrients } = recipePortionNutrients('overnight-oats', lookupOf([oats, milk], [overnightOats]));
    expect(Object.values(nutrients).every((v) => v === null)).toBe(true);
  });

  test('a recipe that contains itself is rejected', () => {
    const a = recipe('a', 1, [{ kind: 'recipe', subRecipeId: 'b', portions: 1 }]);
    const b = recipe('b', 1, [{ kind: 'recipe', subRecipeId: 'a', portions: 1 }]);
    expect(() => recipePortionNutrients('a', lookupOf([], [a, b]))).toThrow('Recipe contains itself');
  });
});

describe('findCycle', () => {
  test('detects an indirect cycle', () => {
    const b = recipe('b', 1, [{ kind: 'recipe', subRecipeId: 'a', portions: 1 }]);
    expect(findCycle('a', ['b'], lookupOf([], [b]))).toBe(true);
  });

  test('a recipe including itself directly is a cycle', () => {
    expect(findCycle('a', ['a'], lookupOf([], []))).toBe(true);
  });

  test('a simple tree is fine', () => {
    expect(findCycle('beef-dinner', ['pico'], lookupOf(allFoods, [pico]))).toBe(false);
  });
});

test('an ingredient measured in a unit that no longer matches its food counts as unknown', () => {
  const wheyNowPer100 = { ...whey, basis: 'per_100g' as const };
  const { nutrients } = recipePortionNutrients('overnight-oats', lookupOf([oats, milk, wheyNowPer100], [overnightOats]));
  expect(Object.values(nutrients).every((v) => v === null)).toBe(true);
});
