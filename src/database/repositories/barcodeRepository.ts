import { normaliseBarcode } from '@/domain/barcode';
import type { FoodProduct } from '@/domain/types';
import type { FoodDraft } from '@/services/food-provider/types';

import type { Db } from '../Db';
import { nowIso } from '../ids';

import { createFood, getFood, updateFood } from './foodRepository';

/** A saved (not deleted) food with this normalised barcode. */
export async function findFoodByBarcode(db: Db, barcode: string): Promise<FoodProduct | null> {
  const row = await db.getFirst<{ id: string }>('SELECT id FROM food_product WHERE barcode = ? AND deleted_at IS NULL', [
    barcode,
  ]);
  return row ? getFood(db, row.id) : null;
}

export async function getCachedDraft(db: Db, barcode: string): Promise<FoodDraft | null> {
  const row = await db.getFirst<{ draft_json: string }>('SELECT draft_json FROM barcode_cache WHERE barcode = ?', [barcode]);
  if (!row) return null;
  try {
    return JSON.parse(row.draft_json) as FoodDraft;
  } catch {
    return null;
  }
}

export async function cacheDraft(db: Db, barcode: string, draft: FoodDraft, source = 'open_food_facts'): Promise<void> {
  await db.run(
    `INSERT INTO barcode_cache (barcode, draft_json, source, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (barcode) DO UPDATE SET draft_json = excluded.draft_json, source = excluded.source, fetched_at = excluded.fetched_at`,
    [barcode, JSON.stringify(draft), source, nowIso()],
  );
}

/**
 * The saved food for a product found by search or scan, saving it on first use (with its picture). A food
 * already saved with that barcode is reused. Calories and protein must be known; otherwise check it first.
 */
export async function saveProductFood(db: Db, product: { barcode: string | null; draft: FoodDraft }): Promise<FoodProduct> {
  const { draft } = product;
  // Search results can carry odd codes (padded, or not a retail barcode at all): keep only real ones.
  const barcode = product.barcode ? normaliseBarcode(product.barcode) : null;
  if (!draft.name || draft.nutrients.kcal === null || draft.nutrients.proteinG === null) {
    throw new RangeError('This product needs its name, calories and protein checked before logging');
  }
  const existing = barcode ? await findFoodByBarcode(db, barcode) : null;
  if (existing) {
    // Fill in a picture, health information or pack size the saved food didn't have yet.
    const patch = {
      ...(existing.packSize === null && draft.packSize ? { packSize: draft.packSize } : {}),
      ...(!existing.imageUrl && draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
      ...(!existing.health && draft.health ? { health: draft.health } : {}),
      ...(!existing.shop && draft.shop ? { shop: draft.shop } : {}),
    };
    return Object.keys(patch).length ? updateFood(db, existing.id, patch) : existing;
  }
  if (barcode) await cacheDraft(db, barcode, draft);
  return createFood(db, {
    name: draft.name,
    brand: draft.brand,
    barcode,
    basis: draft.basis,
    servingSize: draft.servingSize,
    servingUnit: draft.servingSize ? (draft.basis === 'per_100ml' ? 'ml' : 'g') : null,
    packSize: draft.packSize ?? null,
    nutrients: draft.nutrients,
    dataSource: 'open_food_facts',
    notes: null,
    imageUrl: draft.imageUrl ?? null,
    health: draft.health ?? null,
    shop: draft.shop ?? null,
  });
}
