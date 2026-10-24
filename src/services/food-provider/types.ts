import type { HealthInfo } from '@/domain/health';
import type { Nutrients, NutritionBasis } from '@/domain/types';

/** What a provider found for a barcode. Unknown values are null and listed in `missing`. */
export type FoodDraft = {
  name: string | null;
  brand: string | null;
  basis: NutritionBasis;
  servingSize: number | null;
  /** The whole pack in g or ml (a 300 g bag); null when unknown. Older cached drafts don't have it. */
  packSize?: number | null;
  nutrients: Nutrients;
  missing: (keyof Nutrients)[];
  /** A small picture of the pack, when the database has one. */
  imageUrl?: string;
  /** Nutri-Score, processing and additives, when known. */
  health?: HealthInfo;
  /** The shop, from its own brand or Open Food Facts' stores, when known. */
  shop?: string;
  /** One piece, from the pack's serving text ("2 biscuits (25 g)" → a biscuit, 12.5 g), when it's counted in pieces. */
  piece?: { label: string; grams: number };
};

/** A product found by name: its barcode (if any), picture, and draft. */
export type SearchHit = { barcode: string | null; imageUrl: string | null; draft: FoodDraft };

export type SearchResult =
  | { status: 'ok'; hits: SearchHit[] }
  | { status: 'error'; reason: 'offline' | 'timeout' | 'server' | 'busy' };

export type LookupResult =
  | { status: 'found'; draft: FoodDraft }
  | { status: 'not_found' }
  | { status: 'error'; reason: 'offline' | 'timeout' | 'server' };

/** A source of product nutrition by barcode. Never throws; failures come back as results. */
export interface FoodProvider {
  lookup(barcode: string): Promise<LookupResult>;
  /** Products by name. Optional: not every source can search. */
  search?(query: string): Promise<SearchResult>;
}
