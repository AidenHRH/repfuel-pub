import { saveProductFood } from '@/database/repositories/barcodeRepository';
import { deleteFood, listFoods, setFoodFavourite } from '@/database/repositories/foodRepository';
import type { FoodDraft } from '@/services/food-provider/types';

import { migratedDb } from '../helpers/seed';

const kitkat: FoodDraft = {
  name: 'KitKat 4 Finger',
  brand: 'Nestlé',
  basis: 'per_100g',
  servingSize: 41.5,
  imageUrl: 'https://images.openfoodfacts.org/kitkat.200.jpg',
  nutrients: { kcal: 518, proteinG: 6.6, carbsG: 60, fatG: 27, fibreG: 2 },
  missing: [],
};

test('a product found by search or scan is saved once, with its barcode and picture', async () => {
  const db = await migratedDb();
  const food = await saveProductFood(db, { barcode: '7613035239104', draft: kitkat });
  expect(food).toMatchObject({
    name: 'KitKat 4 Finger',
    brand: 'Nestlé',
    barcode: '7613035239104',
    basis: 'per_100g',
    servingSize: 41.5,
    servingUnit: 'g',
    dataSource: 'open_food_facts',
    imageUrl: 'https://images.openfoodfacts.org/kitkat.200.jpg',
  });
  const again = await saveProductFood(db, { barcode: '7613035239104', draft: kitkat });
  expect(again.id).toBe(food.id);
  expect(await listFoods(db, {})).toHaveLength(1);
});

test('a product without a barcode, or whose food was deleted, is saved afresh', async () => {
  const db = await migratedDb();
  const a = await saveProductFood(db, { barcode: null, draft: kitkat });
  const b = await saveProductFood(db, { barcode: '7613035239104', draft: kitkat });
  await deleteFood(db, b.id);
  const c = await saveProductFood(db, { barcode: '7613035239104', draft: kitkat });
  expect(new Set([a.id, b.id, c.id]).size).toBe(3);
});

test('a product missing calories or protein is refused: it needs checking first', async () => {
  const db = await migratedDb();
  await expect(
    saveProductFood(db, {
      barcode: null,
      draft: { ...kitkat, nutrients: { ...kitkat.nutrients, proteinG: null }, missing: ['proteinG'] },
    }),
  ).rejects.toThrow(/protein/);
});

test('a padded barcode matches the same saved product', async () => {
  const db = await migratedDb();
  const food = await saveProductFood(db, { barcode: '07613035239104', draft: kitkat });
  expect(food.barcode).toBe('7613035239104');
  expect((await saveProductFood(db, { barcode: '7613035239104', draft: kitkat })).id).toBe(food.id);
});

test('the health information is kept with the saved food', async () => {
  const db = await migratedDb();
  const food = await saveProductFood(db, {
    barcode: '7613035239104',
    draft: { ...kitkat, health: { nutriscore: 'e', nova: 4, additives: ['E322', 'E476'] } },
  });
  expect(food.health).toEqual({ nutriscore: 'e', nova: 4, additives: ['E322', 'E476'] });
  const plain = await saveProductFood(db, { barcode: null, draft: kitkat });
  expect(plain.health).toBeNull();
});

test('the pack size is kept, and filled in when an older food is scanned again', async () => {
  const db = await migratedDb();
  const pasta: FoodDraft = { ...kitkat, name: 'Fusilli', servingSize: 75, packSize: 500 };
  expect((await saveProductFood(db, { barcode: '5000000000011', draft: pasta })).packSize).toBe(500);

  // Saved before RepFuel knew pack sizes.
  const older = await saveProductFood(db, { barcode: '7613035239104', draft: { ...kitkat, packSize: null } });
  expect(older.packSize).toBeNull();
  await setFoodFavourite(db, older.id, true);
  const again = await saveProductFood(db, { barcode: '7613035239104', draft: { ...kitkat, packSize: 166 } });
  expect(again).toMatchObject({ id: older.id, packSize: 166, isFavourite: true, imageUrl: kitkat.imageUrl });
});
