import { drinkMeasures, isDrink } from '@/domain/drinks';
import { mealCategoryFor, MEAL_CATEGORIES } from '@/domain/meals';

test('drinks are things sold by volume, or built-in drinks', () => {
  expect(isDrink({ basis: 'per_100ml', presetId: null })).toBe(true);
  expect(isDrink({ basis: 'per_serving', presetId: 'latte' })).toBe(true);
  expect(isDrink({ basis: 'per_100g', presetId: 'banana' })).toBe(false);
  expect(isDrink({ basis: 'per_serving', presetId: null })).toBe(false);
});

test('drink sizes: the product’s own serving first, then a can, a glass and a bottle', () => {
  expect(drinkMeasures({ servingSize: 500, presetId: null })).toEqual([
    { label: '1 serving', grams: 500 },
    { label: '1 can', grams: 330 },
    { label: '1 glass', grams: 250 },
    { label: '1 bottle', grams: 500 },
  ]);
  expect(drinkMeasures({ servingSize: null, presetId: null }).map((m) => m.label)).toEqual(['1 can', '1 glass', '1 bottle']);
  expect(drinkMeasures({ servingSize: null, presetId: 'latte' }).map((m) => m.label)).toEqual(['Medium', 'Small', 'Large']);
});

test('the clock never picks Drink; the picker lists it last', () => {
  for (let h = 0; h < 24; h++) expect(mealCategoryFor(new Date(2026, 9, 22, h))).not.toBe('drink');
  expect(MEAL_CATEGORIES).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'drink']);
});
