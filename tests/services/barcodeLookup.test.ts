import { createFood, deleteFood } from '@/database/repositories/foodRepository';
import { lookupBarcode } from '@/services/barcodeLookup';
import type { FoodDraft, FoodProvider, LookupResult } from '@/services/food-provider/types';

import { migratedDb } from '../helpers/seed';

const draft: FoodDraft = {
  name: 'Whey Protein Chocolate',
  brand: 'Test Nutrition',
  basis: 'per_100g',
  servingSize: 25,
  nutrients: { kcal: 400, proteinG: 76, carbsG: 9.2, fatG: 6.1, fibreG: 1.4 },
  missing: [],
};

function provider(...results: LookupResult[]): FoodProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async lookup(code) {
      calls.push(code);
      return results.shift() ?? { status: 'error', reason: 'offline' };
    },
  };
}

const shake = {
  name: 'My shake',
  brand: null,
  barcode: '012345678905',
  basis: 'per_serving' as const,
  servingSize: 30,
  servingUnit: 'g',
  nutrients: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5, fibreG: null },
  dataSource: 'open_food_facts' as const,
  notes: null,
};

test('a barcode you already saved goes straight to that food, without the internet', async () => {
  const db = await migratedDb();
  const saved = await createFood(db, shake);
  const p = provider();
  const result = await lookupBarcode(db, p, '0012345678905');
  expect(result).toEqual({ kind: 'saved', food: expect.objectContaining({ id: saved.id }) });
  expect(p.calls).toEqual([]);
});

test('a found product is cached, so it works offline next time', async () => {
  const db = await migratedDb();
  expect(await lookupBarcode(db, provider({ status: 'found', draft }), '5056000000017')).toEqual({
    kind: 'draft',
    draft,
    barcode: '5056000000017',
    fromCache: false,
  });
  expect(await lookupBarcode(db, provider({ status: 'error', reason: 'offline' }), '5056000000017')).toEqual({
    kind: 'draft',
    draft,
    barcode: '5056000000017',
    fromCache: true,
  });
});

test('offline with nothing cached keeps the barcode for later', async () => {
  const db = await migratedDb();
  expect(await lookupBarcode(db, provider({ status: 'error', reason: 'offline' }), '5056000000017')).toEqual({
    kind: 'error',
    reason: 'offline',
    barcode: '5056000000017',
  });
});

test('an unknown product keeps the barcode for manual entry', async () => {
  const db = await migratedDb();
  expect(await lookupBarcode(db, provider({ status: 'not_found' }), '1234567890128')).toEqual({
    kind: 'not_found',
    barcode: '1234567890128',
  });
});

test('something that is not a food barcode is rejected without a lookup', async () => {
  const db = await migratedDb();
  const p = provider();
  expect(await lookupBarcode(db, p, 'https://example.com')).toEqual({ kind: 'invalid' });
  expect(p.calls).toEqual([]);
});

test('a deleted food does not match; the product is looked up again', async () => {
  const db = await migratedDb();
  const saved = await createFood(db, shake);
  await deleteFood(db, saved.id);
  const p = provider({ status: 'found', draft });
  expect((await lookupBarcode(db, p, '012345678905')).kind).toBe('draft');
});

test('saved foods are stored with the normalised barcode', async () => {
  const db = await migratedDb();
  const saved = await createFood(db, { ...shake, barcode: '0012345678905' });
  expect(saved.barcode).toBe('012345678905');
});
