import { getCommonFood } from '@/domain/commonFoods';
import {
  countOf,
  countPhrase,
  foodMeasures,
  packHint,
  parseServingSize,
  pieceFromPack,
  readPieceWeight,
} from '@/domain/measures';

const product = (basis: 'per_100g' | 'per_100ml' | 'per_serving', servingSize: number | null, packSize: number | null) => ({
  basis,
  servingSize,
  presetId: null,
  packSize,
});

test('a scanned bag: its serving, then the whole pack', () => {
  expect(foodMeasures(product('per_100g', 75, 300))).toEqual([
    { label: '1 serving', grams: 75 },
    { label: '1 pack', grams: 300 },
  ]);
  expect(foodMeasures(product('per_100g', null, 500))).toEqual([{ label: '1 pack', grams: 500 }]);
  expect(foodMeasures(product('per_100g', 40, null))).toEqual([{ label: '1 serving', grams: 40 }]);
  // A pack that is one serving isn't listed twice.
  expect(foodMeasures(product('per_100g', 45, 45))).toEqual([{ label: '1 serving', grams: 45 }]);
});

test('drinks keep their sizes, with the whole pack when it is a different size', () => {
  expect(foodMeasures(product('per_100ml', null, 330)).map((m) => m.label)).toEqual(['1 can', '1 glass', '1 bottle']);
  expect(foodMeasures(product('per_100ml', null, 1000)).map((m) => m.label)).toEqual(['1 can', '1 glass', '1 bottle', '1 pack']);
});

test('built-in foods use their own measures; per-serving foods have none', () => {
  expect(foodMeasures({ basis: 'per_100g', servingSize: 118, presetId: 'banana', packSize: null })).toEqual(
    getCommonFood('banana')!.measures,
  );
  expect(foodMeasures(product('per_serving', null, 300))).toEqual([]);
});

test('how much of the pack, when the pack size is known', () => {
  expect(packHint(150, 300, 'g')).toBe('150 g of a 300 g pack');
  expect(packHint(250, 1000, 'ml')).toBe('250 ml of a 1000 ml pack');
  expect(packHint(150, null, 'g')).toBeNull();
});

test('a food with a piece size offers one piece first', () => {
  expect(foodMeasures({ ...product('per_100g', null, 175), pieceG: 5, pieceLabel: 'Malteser' })).toEqual([
    { label: '1 Malteser', grams: 5 },
    { label: '1 pack', grams: 175 },
  ]);
});

test('one piece from the pack: 37 in a 175 g tub', () => {
  expect(pieceFromPack(175, 37)).toBeCloseTo(4.73, 2);
});

test('a piece weight must be a number above 0', () => {
  expect(readPieceWeight('4.5')).toBe(4.5);
  expect(readPieceWeight('0')).toBeNull();
  expect(readPieceWeight('')).toBeNull();
  expect(readPieceWeight('lots')).toBeNull();
  expect(readPieceWeight('-2')).toBeNull();
});

describe('counting', () => {
  const biscuit = { label: '1 biscuit', grams: 15 };

  test('how many of a size an amount is, in quarters; null when it isn’t a count', () => {
    expect(countOf(30, biscuit)).toBe(2);
    expect(countOf(7.5, biscuit)).toBe(0.5);
    expect(countOf(31, biscuit)).toBeNull();
    expect(countOf(30, null)).toBeNull();
  });

  test('"2 biscuits", "½ biscuit", "2 large", "3 medium slices", "2 glasses"', () => {
    expect(countPhrase(2, biscuit)).toBe('2 biscuits');
    expect(countPhrase(1, biscuit)).toBe('1 biscuit');
    expect(countPhrase(0.5, biscuit)).toBe('½ biscuit');
    expect(countPhrase(2, { label: '1 large', grams: 50 })).toBe('2 large');
    expect(countPhrase(2, { label: '1 large', grams: 50 }, 'Egg')).toBe('2 large eggs');
    expect(countPhrase(1, { label: '1 medium', grams: 118 }, 'Banana')).toBe('1 medium banana');
    expect(countPhrase(2, { label: '1 medium', grams: 200 }, 'Sweet potato, baked')).toBe('2 medium sweet potatoes');
    expect(countPhrase(3, { label: '1 biscuit', grams: 15 }, 'Digestive biscuit')).toBe('3 biscuits');
    expect(countPhrase(3, { label: '1 medium slice', grams: 36 })).toBe('3 medium slices');
    expect(countPhrase(2, { label: '1 glass', grams: 250 })).toBe('2 glasses');
    expect(countPhrase(2, { label: '1 serving', grams: 30 })).toBe('2 servings');
  });

  test('a pack’s serving text gives the size of one: "2 biscuits (25 g)"', () => {
    expect(parseServingSize('2 biscuits (25 g)')).toEqual({ label: 'biscuit', grams: 12.5 });
    expect(parseServingSize('1 sausage (57g)')).toEqual({ label: 'sausage', grams: 57 });
    expect(parseServingSize('3 slices (36,9 g)')).toEqual({ label: 'slice', grams: 12.3 });
    expect(parseServingSize('4 patties (113 g)')).toEqual({ label: 'patty', grams: 28.25 });
    expect(parseServingSize('30 g')).toBeNull();
    expect(parseServingSize('1 portion (250 ml)')).toBeNull();
    expect(parseServingSize(null)).toBeNull();
  });
});
