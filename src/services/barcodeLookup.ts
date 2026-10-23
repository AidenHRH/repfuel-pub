import type { Db } from '@/database/Db';
import { cacheDraft, findFoodByBarcode, getCachedDraft } from '@/database/repositories/barcodeRepository';
import { normaliseBarcode } from '@/domain/barcode';
import type { FoodProduct } from '@/domain/types';

import type { FoodDraft, FoodProvider } from './food-provider/types';

export type BarcodeOutcome =
  | { kind: 'saved'; food: FoodProduct }
  | { kind: 'draft'; draft: FoodDraft; barcode: string; fromCache: boolean }
  | { kind: 'not_found'; barcode: string }
  | { kind: 'error'; reason: 'offline' | 'timeout' | 'server'; barcode: string }
  | { kind: 'invalid' };

/**
 * What a scanned barcode means: a food you already saved (no internet needed), a product found online
 * (cached for offline use), or a not-found / error result that keeps the barcode for manual entry.
 */
export async function lookupBarcode(db: Db, provider: FoodProvider, raw: string): Promise<BarcodeOutcome> {
  const barcode = normaliseBarcode(raw);
  if (!barcode) return { kind: 'invalid' };

  const saved = await findFoodByBarcode(db, barcode);
  if (saved) return { kind: 'saved', food: saved };

  const result = await provider.lookup(barcode);
  if (result.status === 'found') {
    await cacheDraft(db, barcode, result.draft);
    return { kind: 'draft', draft: result.draft, barcode, fromCache: false };
  }
  if (result.status === 'not_found') return { kind: 'not_found', barcode };

  const cached = await getCachedDraft(db, barcode);
  if (cached) return { kind: 'draft', draft: cached, barcode, fromCache: true };
  return { kind: 'error', reason: result.reason, barcode };
}
