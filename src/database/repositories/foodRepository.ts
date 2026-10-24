import type { TakeawayDish, TakeawaySize } from '@/data/takeaways';
import { normaliseBarcode } from '@/domain/barcode';
import type { CommonFood } from '@/domain/commonFoods';
import type { HealthInfo, Nova, NutriScore } from '@/domain/health';
import type { DataSource, FoodProduct, NutritionBasis } from '@/domain/types';

import type { Db } from '../Db';
import { newId, nowIso } from '../ids';

type Row = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  basis: NutritionBasis;
  serving_size: number | null;
  serving_unit: string | null;
  pack_size: number | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sugar_g?: number | null;
  shop?: string | null;
  piece_g?: number | null;
  piece_label?: string | null;
  data_source: DataSource;
  notes: string | null;
  image_url: string | null;
  preset_id: string | null;
  nutriscore: NutriScore | null;
  nova: Nova | null;
  additives_json: string | null;
  is_favourite: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function healthOf(row: Row): HealthInfo | null {
  let additives: string[] = [];
  try {
    additives = row.additives_json ? (JSON.parse(row.additives_json) as string[]) : [];
  } catch {
    additives = [];
  }
  if (!row.nutriscore && !row.nova && additives.length === 0) return null;
  return { nutriscore: row.nutriscore ?? null, nova: row.nova ?? null, additives };
}

function toFood(row: Row): FoodProduct {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    basis: row.basis,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    packSize: row.pack_size ?? null,
    nutrients: {
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      fibreG: row.fibre_g,
      sugarG: row.sugar_g ?? null,
    },
    dataSource: row.data_source,
    isFavourite: row.is_favourite === 1,
    notes: row.notes,
    imageUrl: row.image_url ?? null,
    presetId: row.preset_id ?? null,
    health: healthOf(row),
    // '' means asked and skipped: no shop, and don't ask again.
    shop: row.shop || null,
    pieceG: row.piece_g ?? null,
    pieceLabel: row.piece_label ?? null,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type NewFood = Omit<
  FoodProduct,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
  | 'isFavourite'
  | 'imageUrl'
  | 'presetId'
  | 'health'
  | 'packSize'
  | 'shop'
  | 'pieceG'
  | 'pieceLabel'
> & {
  shop?: string | null;
  pieceG?: number | null;
  pieceLabel?: string | null;
  packSize?: number | null;
  isFavourite?: boolean;
  imageUrl?: string | null;
  presetId?: string | null;
  health?: HealthInfo | null;
};

export async function createFood(db: Db, input: NewFood): Promise<FoodProduct> {
  const id = newId();
  const now = nowIso();
  const n = input.nutrients;
  await db.run(
    `INSERT INTO food_product (id, name, brand, barcode, basis, serving_size, serving_unit, kcal, protein_g, carbs_g, fat_g, fibre_g,
       data_source, notes, image_url, preset_id, nutriscore, nova, additives_json, is_favourite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.brand,
      input.barcode ? normaliseBarcode(input.barcode) : null,
      input.basis,
      input.servingSize,
      input.servingUnit,
      n.kcal,
      n.proteinG,
      n.carbsG,
      n.fatG,
      n.fibreG,
      input.dataSource,
      input.notes,
      input.imageUrl ?? null,
      input.presetId ?? null,
      input.health?.nutriscore ?? null,
      input.health?.nova ?? null,
      input.health ? JSON.stringify(input.health.additives) : null,
      input.isFavourite ? 1 : 0,
      now,
      now,
    ],
  );
  // Written only when known, so the insert above stays the same as before pack sizes (tests build older databases).
  if (input.packSize) await db.run('UPDATE food_product SET pack_size = ? WHERE id = ?', [input.packSize, id]);
  if (n.sugarG != null || input.shop || input.pieceG)
    await db.run('UPDATE food_product SET sugar_g = ?, shop = ?, piece_g = ?, piece_label = ? WHERE id = ?', [
      n.sugarG ?? null,
      input.shop ?? null,
      input.pieceG ?? null,
      input.pieceG ? (input.pieceLabel ?? null) : null,
      id,
    ]);
  return (await getFood(db, id))!;
}

/** Reads a food even if it was deleted, so recipes and history keep resolving. */
export async function getFood(db: Db, id: string): Promise<FoodProduct | null> {
  const row = await db.getFirst<Row>('SELECT * FROM food_product WHERE id = ?', [id]);
  return row ? toFood(row) : null;
}

export async function updateFood(db: Db, id: string, patch: Partial<NewFood>): Promise<FoodProduct> {
  const current = await getFood(db, id);
  if (!current) throw new Error('Food not found');
  const next = { ...current, ...patch };
  const n = next.nutrients;
  await db.run(
    `UPDATE food_product SET name = ?, brand = ?, barcode = ?, basis = ?, serving_size = ?, serving_unit = ?, pack_size = ?, kcal = ?, protein_g = ?,
       carbs_g = ?, fat_g = ?, fibre_g = ?, data_source = ?, notes = ?, image_url = ?, nutriscore = ?, nova = ?, additives_json = ?,
       is_favourite = ?, updated_at = ? WHERE id = ?`,
    [
      next.name.trim(),
      next.brand,
      next.barcode,
      next.basis,
      next.servingSize,
      next.servingUnit,
      next.packSize ?? null,
      n.kcal,
      n.proteinG,
      n.carbsG,
      n.fatG,
      n.fibreG,
      next.dataSource,
      next.notes,
      next.imageUrl ?? null,
      next.health?.nutriscore ?? null,
      next.health?.nova ?? null,
      next.health ? JSON.stringify(next.health.additives) : null,
      next.isFavourite ? 1 : 0,
      nowIso(),
      id,
    ],
  );
  await db.run('UPDATE food_product SET sugar_g = ?, piece_g = ?, piece_label = ? WHERE id = ?', [
    n.sugarG ?? null,
    next.pieceG ?? null,
    next.pieceG ? (next.pieceLabel ?? null) : null,
    id,
  ]);
  // Only a patch that names the shop changes it, so a skipped question stays skipped.
  if ('shop' in patch) await setFoodShop(db, id, patch.shop ?? null);
  return (await getFood(db, id))!;
}

/** Soft delete: the food leaves lists, but recipes and past entries keep working. */
export async function deleteFood(db: Db, id: string): Promise<void> {
  // The barcode is released so the same product can be scanned in again later.
  await db.run('UPDATE food_product SET deleted_at = ?, barcode = NULL, is_favourite = 0 WHERE id = ?', [nowIso(), id]);
}

export async function setFoodFavourite(db: Db, id: string, favourite: boolean): Promise<void> {
  await db.run('UPDATE food_product SET is_favourite = ?, updated_at = ? WHERE id = ?', [favourite ? 1 : 0, nowIso(), id]);
}

export async function listFoods(db: Db, { search }: { search?: string }): Promise<FoodProduct[]> {
  const term = search?.trim().toLowerCase();
  const rows = term
    ? await db.getAll<Row>(
        `SELECT * FROM food_product WHERE deleted_at IS NULL AND (instr(lower(name), ?) > 0 OR instr(lower(coalesce(brand, '')), ?) > 0)
         ORDER BY is_favourite DESC, name COLLATE NOCASE`,
        [term, term],
      )
    : await db.getAll<Row>('SELECT * FROM food_product WHERE deleted_at IS NULL ORDER BY is_favourite DESC, name COLLATE NOCASE');
  return rows.map(toFood);
}

/** The saved food for a built-in common food, saving it (typical values, first measure as its serving) on first use. */
export async function savePresetFood(db: Db, preset: CommonFood): Promise<FoodProduct> {
  const row = await db.getFirst<{ id: string }>(
    'SELECT id FROM food_product WHERE preset_id = ? AND deleted_at IS NULL LIMIT 1',
    [preset.id],
  );
  if (row) return (await getFood(db, row.id))!;
  return createFood(db, {
    name: preset.name,
    brand: null,
    barcode: null,
    basis: preset.basis,
    servingSize: preset.measures[0].grams,
    servingUnit: preset.basis === 'per_100ml' ? 'ml' : 'g',
    nutrients: preset.per100,
    dataSource: 'manual',
    notes: 'Typical values',
    presetId: preset.id,
  });
}

/** Sets a food's shop; null records that the owner skipped the question, so it isn't asked again. */
export async function setFoodShop(db: Db, id: string, shop: string | null): Promise<void> {
  await db.run('UPDATE food_product SET shop = ?, updated_at = ? WHERE id = ?', [shop ?? '', nowIso(), id]);
}

/** True until the owner has picked a shop for this food or skipped the question. */
export async function shopUnasked(db: Db, id: string): Promise<boolean> {
  const row = await db.getFirst<{ shop: string | null }>('SELECT shop FROM food_product WHERE id = ?', [id]);
  return row ? row.shop === null : false;
}

/** Remembers what one piece of a food is called and weighs (g or ml), so it can be logged by the piece. */
export async function setPieceSize(db: Db, id: string, grams: number, label: string): Promise<FoodProduct> {
  if (!Number.isFinite(grams) || grams <= 0) throw new RangeError('A piece must weigh more than 0');
  await db.run('UPDATE food_product SET piece_g = ?, piece_label = ?, updated_at = ? WHERE id = ?', [
    grams,
    label.trim() || 'piece',
    nowIso(),
    id,
  ]);
  return (await getFood(db, id))!;
}

/** A takeaway dish at a size, as a saved food (an estimate, per serving), reused when had again. */
export async function saveTakeawayFood(db: Db, dish: TakeawayDish, size: TakeawaySize): Promise<FoodProduct> {
  const presetId = `takeaway:${dish.id}:${size.label.toLowerCase().replace(/\s+/g, '-')}`;
  const row = await db.getFirst<{ id: string }>(
    'SELECT id FROM food_product WHERE preset_id = ? AND deleted_at IS NULL LIMIT 1',
    [presetId],
  );
  if (row) return (await getFood(db, row.id))!;
  const portion = size.label === '1 slice' ? 'a slice' : size.label.toLowerCase();
  return createFood(db, {
    name: `${dish.name} (takeaway, ${portion})`,
    brand: null,
    barcode: null,
    basis: 'per_serving',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: size.kcal, proteinG: size.proteinG, carbsG: size.carbsG, fatG: size.fatG, fibreG: null },
    dataSource: 'user_approximate',
    notes: `${dish.cuisine} takeaway: an estimate from typical UK portions`,
    presetId,
  });
}
