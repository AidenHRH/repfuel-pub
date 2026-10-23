import { getCommonFood } from '@/domain/commonFoods';
import { foodMeasures, packHint } from '@/domain/measures';

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
