import { createFood, deleteFood, getFood, listFoods, setFoodFavourite, updateFood } from '@/database/repositories/foodRepository';

import { migratedDb } from '../helpers/seed';

const wheyInput = {
  name: 'Whey isolate',
  brand: 'Bulk',
  barcode: '5056000000001',
  basis: 'per_serving' as const,
  servingSize: 30,
  servingUnit: 'g',
  nutrients: { kcal: 112, proteinG: 27, carbsG: 0.6, fatG: null, fibreG: null },
  dataSource: 'manual' as const,
  notes: null,
};

test('a created food round-trips every field, keeping unknown values unknown', async () => {
  const db = await migratedDb();
  const created = await createFood(db, wheyInput);
  expect(await getFood(db, created.id)).toEqual(
    expect.objectContaining({
      ...wheyInput,
      nutrients: { ...wheyInput.nutrients, sugarG: null },
      shop: null,
      pieceG: null,
      pieceLabel: null,
      isFavourite: false,
      deletedAt: null,
      id: created.id,
    }),
  );
});

test('search matches name or brand, ignoring case', async () => {
  const db = await migratedDb();
  await createFood(db, wheyInput);
  await createFood(db, { ...wheyInput, name: 'Oats', brand: null, barcode: null });
  expect((await listFoods(db, { search: 'WHEY' })).map((f) => f.name)).toEqual(['Whey isolate']);
  expect((await listFoods(db, { search: 'bulk' })).map((f) => f.name)).toEqual(['Whey isolate']);
});

test('favourites list first, then alphabetical', async () => {
  const db = await migratedDb();
  const z = await createFood(db, { ...wheyInput, name: 'Zesty yoghurt', barcode: null });
  await createFood(db, { ...wheyInput, name: 'Apple', barcode: null });
  await setFoodFavourite(db, z.id, true);
  expect((await listFoods(db, {})).map((f) => f.name)).toEqual(['Zesty yoghurt', 'Apple']);
});

test('deleted foods disappear from lists but can still be read for history', async () => {
  const db = await migratedDb();
  const f = await createFood(db, wheyInput);
  await deleteFood(db, f.id);
  expect(await listFoods(db, {})).toEqual([]);
  expect((await getFood(db, f.id))?.deletedAt).not.toBeNull();
});

test('updates change only the given fields', async () => {
  const db = await migratedDb();
  const f = await createFood(db, wheyInput);
  const updated = await updateFood(db, f.id, { nutrients: { ...wheyInput.nutrients, proteinG: 26 } });
  expect(updated.nutrients.proteinG).toBe(26);
  expect(updated.name).toBe('Whey isolate');
});
