import { getCommonFood } from '@/domain/commonFoods';
import { CONTAINS, dietSummary, excludedBy, fitsDiet, type DietPrefs } from '@/domain/diet';
import { MEAL_TEMPLATES, templateNutrients, templateTags, type PlanSlot } from '@/domain/mealTemplates';

test('every food the diet table mentions is a real common food', () => {
  for (const id of Object.keys(CONTAINS)) expect(getCommonFood(id)).not.toBeNull();
});

test('diets leave out what they should', () => {
  expect([...excludedBy({ style: 'vegetarian', dairyFree: false, glutenFree: false })].sort()).toEqual(['fish', 'meat']);
  expect([...excludedBy({ style: 'pescatarian', dairyFree: false, glutenFree: true })].sort()).toEqual(['gluten', 'meat']);
  expect([...excludedBy({ style: 'vegan', dairyFree: false, glutenFree: false })].sort()).toEqual([
    'dairy',
    'egg',
    'fish',
    'honey',
    'meat',
  ]);
  expect(fitsDiet(['dairy'], excludedBy({ style: 'any', dairyFree: true, glutenFree: false }))).toBe(false);
  expect(dietSummary({ style: 'vegan', dairyFree: true, glutenFree: true, useMyMeals: true })).toBe('Vegan · gluten-free');
});

test('the simple meals use real foods and sensible amounts', () => {
  for (const t of MEAL_TEMPLATES) {
    const n = templateNutrients(t);
    expect(n.kcal).toBeGreaterThan(t.slot === 'snack' ? 80 : 250);
    expect(n.kcal).toBeLessThan(t.slot === 'snack' ? 320 : 850);
  }
});

const SLOTS: PlanSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const DIETS: Pick<DietPrefs, 'style' | 'dairyFree' | 'glutenFree'>[] = (
  ['any', 'vegetarian', 'pescatarian', 'vegan'] as const
).flatMap((style) => [false, true].flatMap((dairyFree) => [false, true].map((glutenFree) => ({ style, dairyFree, glutenFree }))));

test.each(DIETS.map((d) => [`${d.style}${d.dairyFree ? ', dairy-free' : ''}${d.glutenFree ? ', gluten-free' : ''}`, d] as const))(
  '%s: at least two meals to choose from at every meal of the day',
  (_label, diet) => {
    const excluded = excludedBy(diet);
    for (const slot of SLOTS) {
      const options = MEAL_TEMPLATES.filter((t) => t.slot === slot && fitsDiet(templateTags(t), excluded));
      expect(options.length).toBeGreaterThanOrEqual(2);
    }
  },
);
