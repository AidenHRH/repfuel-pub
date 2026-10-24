import { emptyFoodForm, validateFoodForm } from '@/features/nutrition/foodForm';

const base = { ...emptyFoodForm(), name: 'Gousto katsu', kcal: '650', protein: '40' };

test('name, calories and protein are required', () => {
  const result = validateFoodForm({ ...emptyFoodForm() });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['kcal', 'name', 'protein']);
});

test('blank optional values stay unknown', () => {
  const result = validateFoodForm(base);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.food.nutrients).toEqual({ kcal: 650, proteinG: 40, carbsG: null, fatG: null, fibreG: null, sugarG: null });
    expect(result.food.basis).toBe('per_serving');
  }
});

test('estimates are stored as the owner’s approximation', () => {
  const result = validateFoodForm({ ...base, approximate: true });
  expect(result.ok && result.food.dataSource).toBe('user_approximate');
  const exact = validateFoodForm({ ...base, approximate: false });
  expect(exact.ok && exact.food.dataSource).toBe('manual');
});

test('typing something that is not a number is an error, never zero', () => {
  const result = validateFoodForm({ ...base, carbs: 'lots' });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.carbs).toBe('Enter a number');
});

test('comma decimals are fine', () => {
  const result = validateFoodForm({ ...base, fat: '12,5' });
  expect(result.ok && result.food.nutrients.fatG).toBe(12.5);
});

test('per-100 g foods keep an optional usual serving size', () => {
  const result = validateFoodForm({ ...base, basis: 'per_100g', servingSize: '150' });
  expect(result.ok && result.food).toMatchObject({ basis: 'per_100g', servingSize: 150, servingUnit: 'g' });
});

describe('editing a scanned food', () => {
  const { formFromFood, editedFood } = jest.requireActual('@/features/nutrition/foodForm');
  const scanned = {
    id: 'f1',
    name: 'Whey Protein Chocolate',
    brand: 'Test Nutrition',
    barcode: '5056000000017',
    basis: 'per_100g' as const,
    servingSize: 25,
    servingUnit: 'g',
    nutrients: { kcal: 400, proteinG: 76, carbsG: 9.2, fatG: 6.1, fibreG: 1.4 },
    dataSource: 'open_food_facts' as const,
    isFavourite: false,
    notes: 'tub in cupboard',
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
  };

  test('renaming keeps the barcode, notes and Open Food Facts source', () => {
    const result = validateFoodForm({ ...formFromFood(scanned), name: 'Choc whey' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect({ ...scanned, ...editedFood(scanned, result.food) }).toMatchObject({
        name: 'Choc whey',
        barcode: '5056000000017',
        notes: 'tub in cupboard',
        dataSource: 'open_food_facts',
      });
    }
  });

  test('changing nutrition marks it as your own values but keeps the barcode', () => {
    const result = validateFoodForm({ ...formFromFood(scanned), protein: '78' });
    if (!result.ok) throw new Error('expected valid');
    expect({ ...scanned, ...editedFood(scanned, result.food) }).toMatchObject({ barcode: '5056000000017', dataSource: 'manual' });
  });
});
