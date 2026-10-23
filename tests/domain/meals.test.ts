import { groupByMeal, mealCategoryFor } from '@/domain/meals';
import type { FoodLogEntry, MealCategory } from '@/domain/types';

const at = (hhmm: string) => new Date(`2026-10-21T${hhmm}:00`);

test.each([
  ['06:30', 'breakfast'],
  ['10:59', 'breakfast'],
  ['11:00', 'lunch'],
  ['14:59', 'lunch'],
  ['15:00', 'snack'],
  ['17:00', 'dinner'],
  ['20:59', 'dinner'],
  ['21:00', 'snack'],
  ['00:30', 'snack'],
  ['04:59', 'snack'],
  ['05:00', 'breakfast'],
])('%s local time is %s', (hhmm, expected) => {
  expect(mealCategoryFor(at(hhmm))).toBe(expected);
});

function entry(id: string, mealCategory: MealCategory, kcal: number | null, proteinG: number, loggedAt: string): FoodLogEntry {
  return {
    id,
    foodId: null,
    recipeId: null,
    name: id,
    amount: 1,
    unit: 'portion',
    nutrients: { kcal, proteinG, carbsG: null, fatG: null, fibreG: null },
    isApproximate: false,
    loggedAt,
    localDay: '2026-10-22',
    mealCategory,
    notes: null,
  };
}

test('entries group into breakfast, lunch, dinner, snacks with subtotals', () => {
  const sections = groupByMeal([
    entry('shake', 'snack', 120, 24, '2026-10-22T16:00:00Z'),
    entry('oats', 'breakfast', 400, 37, '2026-10-22T07:30:00Z'),
    entry('beef', 'dinner', 450, 35, '2026-10-22T18:30:00Z'),
    entry('coffee', 'breakfast', 50, 2, '2026-10-22T08:00:00Z'),
  ]);
  expect(sections.map((s) => s.label)).toEqual(['Breakfast', 'Dinner', 'Snacks']);
  expect(sections[0].entries.map((e) => e.id)).toEqual(['oats', 'coffee']);
  expect(sections[0].totals.totals.kcal).toBe(450);
  expect(sections[0].totals.totals.proteinG).toBe(39);
});

test('a section follows each entry’s own category, not the clock, and keeps unknowns visible', () => {
  // Logged just after midnight but moved to dinner by the owner.
  const sections = groupByMeal([entry('late pizza', 'dinner', null, 30, '2026-10-22T00:20:00Z')]);
  expect(sections).toHaveLength(1);
  expect(sections[0].category).toBe('dinner');
  expect(sections[0].totals.incomplete.kcal).toBe(true);
});

test('no entries means no sections', () => {
  expect(groupByMeal([])).toEqual([]);
});

test('drinks have their own section, after snacks', () => {
  const e = (id: string, mealCategory: MealCategory): FoodLogEntry => ({
    id,
    foodId: null,
    recipeId: null,
    name: id,
    amount: 1,
    unit: 'serving',
    nutrients: { kcal: 100, proteinG: 1, carbsG: null, fatG: null, fibreG: null },
    isApproximate: false,
    loggedAt: '2026-10-22T12:00:00.000Z',
    localDay: '2026-10-22',
    mealCategory,
    notes: null,
  });
  expect(groupByMeal([e('cola', 'drink'), e('crisps', 'snack'), e('oats', 'breakfast')]).map((s) => s.label)).toEqual([
    'Breakfast',
    'Snacks',
    'Drinks',
  ]);
});
