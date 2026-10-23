import { estimate, matchIngredient, parseMeasure } from '@/domain/mealdbMatch';

describe('parseMeasure', () => {
  test('weights and volumes become grams', () => {
    expect(parseMeasure('200g')).toEqual({ grams: 200 });
    expect(parseMeasure('1.5 kg')).toEqual({ grams: 1500 });
    expect(parseMeasure('400g tin')).toEqual({ grams: 400 });
    expect(parseMeasure('250 ml')).toEqual({ grams: 250 });
    expect(parseMeasure('1 litre')).toEqual({ grams: 1000 });
    expect(parseMeasure('8 oz')).toEqual({ grams: 226.8 });
    expect(parseMeasure('1lb')).toEqual({ grams: 453.6 });
  });

  test('spoons and cups keep their unit, with fractions', () => {
    expect(parseMeasure('1/2 cup')).toEqual({ count: 0.5, unit: 'cup' });
    expect(parseMeasure('2 tbsp')).toEqual({ count: 2, unit: 'tbsp' });
    expect(parseMeasure('1 1/2 tsp')).toEqual({ count: 1.5, unit: 'tsp' });
    expect(parseMeasure('½ Teaspoon')).toEqual({ count: 0.5, unit: 'tsp' });
    expect(parseMeasure('3 tablespoons')).toEqual({ count: 3, unit: 'tbsp' });
  });

  test('plain counts are pieces', () => {
    expect(parseMeasure('2')).toEqual({ count: 2, unit: 'piece' });
    expect(parseMeasure('3 cloves')).toEqual({ count: 3, unit: 'piece' });
    expect(parseMeasure('1 large')).toEqual({ count: 1, unit: 'piece' });
  });

  test('a pinch, to taste and blanks cannot be measured', () => {
    expect(parseMeasure('Pinch')).toBeNull();
    expect(parseMeasure('to taste')).toBeNull();
    expect(parseMeasure('')).toBeNull();
    expect(parseMeasure('Dash')).toBeNull();
  });
});

describe('matchIngredient', () => {
  test('matches TheMealDB names to built-in foods', () => {
    expect(matchIngredient('Chicken Breasts')).toBe('chicken-breast-raw');
    expect(matchIngredient('Onions')).toBe('onion');
    expect(matchIngredient('Basmati Rice')).toBe('white-rice-dry');
    expect(matchIngredient('Spaghetti')).toBe('pasta-dry');
    expect(matchIngredient('Minced Beef')).toBe('beef-mince-5');
    expect(matchIngredient('Olive Oil')).toBe('olive-oil');
    expect(matchIngredient('Eggs')).toBe('egg');
    expect(matchIngredient('Chopped Tomatoes')).toBe('chopped-tomatoes');
  });

  test('unknown ingredients do not match', () => {
    expect(matchIngredient('Saffron')).toBeNull();
    expect(matchIngredient('')).toBeNull();
  });
});

describe('estimate', () => {
  test('adds up what it can match and measure, and lists the rest', () => {
    const r = estimate([
      { name: 'Chicken Breast', measure: '200g' },
      { name: 'Olive Oil', measure: '1 tbsp' },
      { name: 'Saffron', measure: 'pinch' },
      { name: 'Onion', measure: 'to taste' },
      { name: 'Salt', measure: 'pinch' },
    ]);
    expect(r.counted).toEqual(['Chicken Breast', 'Olive Oil', 'Salt']);
    expect(r.notCounted).toEqual(['Saffron', 'Onion']);
    expect(r.nutrients.kcal).toBeGreaterThan(300);
    expect(r.nutrients.proteinG).toBeGreaterThan(40);
  });

  test('pieces use the food’s own size', () => {
    const r = estimate([{ name: 'Eggs', measure: '2' }]);
    expect(r.counted).toEqual(['Eggs']);
    expect(r.nutrients.kcal).toBeGreaterThan(120);
    expect(r.nutrients.kcal).toBeLessThan(180);
  });

  test('nothing counted means unknown, never zero', () => {
    const r = estimate([{ name: 'Saffron', measure: '1 tsp' }]);
    expect(r.nutrients.kcal).toBeNull();
    expect(r.nutrients.proteinG).toBeNull();
  });
});
