import { calculateLogged, roundForDisplay, sumEntries } from '@/domain/nutrition';
import type { Nutrients } from '@/domain/types';

// Per 30 g serving: 120 kcal, 24 g protein, 3 g carbs, fat unknown.
const wheyServing: Nutrients = { kcal: 120, proteinG: 24, carbsG: 3, fatG: null, fibreG: null };

describe('calculateLogged — per-serving products', () => {
  test('one serving logs the label values', () => {
    expect(calculateLogged(wheyServing, 'per_serving', { servings: 1 })).toEqual(wheyServing);
  });

  test('two servings doubles every known value', () => {
    expect(calculateLogged(wheyServing, 'per_serving', { servings: 2 })).toEqual({
      kcal: 240,
      proteinG: 48,
      carbsG: 6,
      fatG: null,
      fibreG: null,
    });
  });

  test('half and one-and-a-half servings', () => {
    expect(calculateLogged(wheyServing, 'per_serving', { servings: 0.5 })).toMatchObject({ kcal: 60, proteinG: 12 });
    expect(calculateLogged(wheyServing, 'per_serving', { servings: 1.5 })).toMatchObject({ kcal: 180, proteinG: 36 });
  });

  test('unknown values stay unknown, never zero', () => {
    const logged = calculateLogged(wheyServing, 'per_serving', { servings: 3 });
    expect(logged.fatG).toBeNull();
    expect(logged.fibreG).toBeNull();
  });
});

describe('calculateLogged — per-100 products', () => {
  test('per 100 g: 80 g protein per 100 g, 45 g eaten → 36 g (PRD example)', () => {
    const per100g: Nutrients = { kcal: 400, proteinG: 80, carbsG: 8, fatG: 6, fibreG: null };
    expect(calculateLogged(per100g, 'per_100g', { quantity: 45, unit: 'g' })).toEqual({
      kcal: 180,
      proteinG: 36,
      carbsG: 3.6,
      fatG: 2.7,
      fibreG: null,
    });
  });

  test('per 100 ml: 3.4 g protein per 100 ml, 250 ml → 8.5 g', () => {
    const milk: Nutrients = { kcal: 47, proteinG: 3.4, carbsG: 4.7, fatG: 1.7, fibreG: 0 };
    const logged = calculateLogged(milk, 'per_100ml', { quantity: 250, unit: 'ml' });
    expect(logged.proteinG).toBeCloseTo(8.5, 10);
    expect(logged.fibreG).toBe(0);
  });
});

describe('calculateLogged — invalid amounts', () => {
  test('negative servings are rejected', () => {
    expect(() => calculateLogged(wheyServing, 'per_serving', { servings: -1 })).toThrow(RangeError);
  });

  test('non-finite amounts are rejected', () => {
    expect(() => calculateLogged(wheyServing, 'per_serving', { servings: Number.NaN })).toThrow(RangeError);
    expect(() => calculateLogged(wheyServing, 'per_100g', { quantity: Infinity, unit: 'g' })).toThrow(RangeError);
  });

  test('a unit that does not match the basis is rejected', () => {
    expect(() => calculateLogged(wheyServing, 'per_100g', { quantity: 50, unit: 'ml' })).toThrow(RangeError);
    expect(() => calculateLogged(wheyServing, 'per_serving', { quantity: 50, unit: 'g' })).toThrow(RangeError);
    expect(() => calculateLogged(wheyServing, 'per_100g', { servings: 1 })).toThrow(RangeError);
  });
});

describe('sumEntries', () => {
  const entry = (n: Partial<Nutrients>, isApproximate = false) => ({
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fibreG: null,
    ...n,
    isApproximate,
  });

  test('adds stored values at full precision, without rounding first', () => {
    const day = sumEntries([entry({ proteinG: 24.4, kcal: 100.4 }), entry({ proteinG: 24.4, kcal: 100.4 })]);
    expect(day.totals.proteinG).toBeCloseTo(48.8, 10);
    expect(day.totals.kcal).toBeCloseTo(200.8, 10);
  });

  test('an unknown nutrient marks that total incomplete and still sums the known ones', () => {
    const day = sumEntries([entry({ fatG: 10, proteinG: 5 }), entry({ fatG: null, proteinG: 5 })]);
    expect(day.totals.fatG).toBe(10);
    expect(day.incomplete.fatG).toBe(true);
    expect(day.incomplete.proteinG).toBe(false);
  });

  test('one approximate entry marks the day approximate', () => {
    expect(sumEntries([entry({ kcal: 650 }, true), entry({ kcal: 100 })]).approximate).toBe(true);
    expect(sumEntries([entry({ kcal: 100 })]).approximate).toBe(false);
  });

  test('no entries gives zero totals that are complete and exact', () => {
    const day = sumEntries([]);
    expect(day.totals).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0, sugarG: 0 });
    expect(Object.values(day.incomplete).some(Boolean)).toBe(false);
    expect(day.approximate).toBe(false);
  });
});

describe('roundForDisplay', () => {
  test('kcal rounds to whole numbers with thousands separators', () => {
    expect(roundForDisplay(2499.6, 'kcal')).toBe('2,500');
    expect(roundForDisplay(980.4, 'kcal')).toBe('980');
  });

  test('grams round to whole numbers', () => {
    expect(roundForDisplay(36.5, 'g')).toBe('37');
    expect(roundForDisplay(8.49, 'g')).toBe('8');
  });

  test('unknown shows a dash, not zero', () => {
    expect(roundForDisplay(null, 'g')).toBe('—');
  });
});
