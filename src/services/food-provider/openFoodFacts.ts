import appConfig from '../../../app.json';
import { additiveCode, type HealthInfo, type Nova, type NutriScore } from '@/domain/health';
import type { Nutrients, NutritionBasis } from '@/domain/types';

import type { FoodDraft, FoodProvider, LookupResult, SearchHit, SearchResult } from './types';

const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'serving_quantity',
  'nutriments',
  'image_front_small_url',
  'nutriscore_grade',
  'nova_group',
  'additives_tags',
  'countries_tags',
];

const SEARCH_PAGE_SIZE = 24;
// Open Food Facts allows 10 searches a minute per user; stay under it rather than risk a ban.
const SEARCH_LIMIT_PER_MINUTE = 8;
// Matches from the search service are loaded one by one (product reads allow 100 a minute).
const PRODUCTS_PER_SEARCH = 10;
// Open Food Facts' search service. Its older search (cgi/search.pl) now mostly answers 503, so it is only a fallback.
const SEARCH_SERVICE = 'https://search.openfoodfacts.org/search';
const UK = 'en:united-kingdom';

// Open Food Facts asks every app to identify itself.
const USER_AGENT = `RepFuel/${appConfig.expo.version} (Android app; github.com/AidenHRH/repfuel-pub)`;

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown): number | null {
  if (typeof v === 'string' && !v.trim()) return null; // Number('') is 0, but blank means unknown
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function basisOf(product: Json): NutritionBasis {
  const unit = text(product.product_quantity_unit)?.toLowerCase();
  const quantity = text(product.quantity)?.toLowerCase() ?? '';
  const liquid = unit === 'ml' || unit === 'l' || unit === 'cl' || /\d\s*(ml|cl|l)\b/.test(quantity);
  return liquid ? 'per_100ml' : 'per_100g';
}

const PACK_UNITS: Record<string, number> = { g: 1, ml: 1, kg: 1000, l: 1000, cl: 10 };

/** The pack size in g or ml (Open Food Facts gives it in g or ml already, sometimes kg or l); null when unknown. */
function packSizeOf(product: Json): number | null {
  const size = num(product.product_quantity);
  const unit = text(product.product_quantity_unit)?.toLowerCase() ?? 'g';
  const factor = PACK_UNITS[unit];
  return size && factor ? Math.round(size * factor * 100) / 100 : null;
}

function healthOf(product: Json): HealthInfo | undefined {
  const grade = text(product.nutriscore_grade)?.toLowerCase();
  const nutriscore = grade && /^[a-e]$/.test(grade) ? (grade as NutriScore) : null;
  const n = num(product.nova_group);
  const nova = n !== null && Number.isInteger(n) && n >= 1 && n <= 4 ? (n as Nova) : null;
  const tags = Array.isArray(product.additives_tags) ? product.additives_tags : [];
  const additives = tags.flatMap((t) => (typeof t === 'string' && additiveCode(t) ? [additiveCode(t)!] : []));
  return nutriscore || nova || additives.length ? { nutriscore, nova, additives } : undefined;
}

/** Turns an Open Food Facts product response into a draft. Missing values stay null; nothing is invented. */
export function parseOffProduct(json: unknown): FoodDraft | null {
  if (!isObject(json) || !isObject(json.product)) return null;
  const product = json.product;
  const n = isObject(product.nutriments) ? product.nutriments : {};

  const nutrients: Nutrients = {
    kcal: num(n['energy-kcal_100g']),
    proteinG: num(n.proteins_100g),
    carbsG: num(n.carbohydrates_100g),
    fatG: num(n.fat_100g),
    fibreG: num(n.fiber_100g),
    sugarG: num(n.sugars_100g),
  };
  const name = text(product.product_name) ?? text(product.product_name_en);
  const hasAnyNutrient = Object.values(nutrients).some((v) => v !== null);
  if (!name && !hasAnyNutrient) return null;
  const imageUrl = text(product.image_front_small_url);
  const health = healthOf(product);

  return {
    ...(health ? { health } : {}),
    ...(imageUrl?.startsWith('https://') ? { imageUrl } : {}),
    name,
    brand: text(product.brands)?.split(',')[0].trim() || null,
    basis: basisOf(product),
    servingSize: num(product.serving_quantity) || null,
    packSize: packSizeOf(product),
    nutrients,
    missing: (Object.keys(nutrients) as (keyof Nutrients)[]).filter((k) => nutrients[k] === null),
  };
}

type Failure = { status: 'error'; reason: 'offline' | 'timeout' | 'server' };

/** Fetches JSON from Open Food Facts; failures come back as results, never thrown. */
async function getJson(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<{ status: number; body: unknown } | Failure> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: await res.json() };
  } catch (error) {
    // Expo's fetch reports network failures and cancellations as plain Errors, so classify by cause.
    if (controller.signal.aborted) return { status: 'error', reason: 'timeout' };
    if (error instanceof SyntaxError) return { status: 'error', reason: 'server' };
    return { status: 'error', reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Search results worth showing: named products with calories, as drafts. */
export function parseOffSearch(body: unknown): SearchHit[] {
  if (!isObject(body) || !Array.isArray(body.products)) return [];
  return body.products.flatMap((product): SearchHit[] => {
    const draft = parseOffProduct({ product });
    if (!draft?.name || draft.nutrients.kcal === null) return [];
    const barcode = isObject(product) ? text(product.code) : null;
    return [{ barcode, imageUrl: draft.imageUrl ?? null, draft }];
  });
}

/** Barcodes from a search-service answer (`{ hits: [{ code }] }`), in its order of relevance. */
export function parseSearchServiceCodes(body: unknown): string[] {
  if (!isObject(body) || !Array.isArray(body.hits)) return [];
  const codes = body.hits.flatMap((hit) => {
    if (!isObject(hit)) return [];
    const code = typeof hit.code === 'number' ? String(hit.code) : text(hit.code);
    return code && /^\d{6,14}$/.test(code) ? [code] : [];
  });
  return [...new Set(codes)];
}

export function createOpenFoodFactsProvider(fetchImpl: typeof fetch = fetch, timeoutMs = 8000): Required<FoodProvider> {
  const cache = new Map<string, SearchHit[]>();
  const recent: number[] = [];

  // Counts every search request (a fallback search is another one); product reads are not searches.
  const takeSearchSlot = (): boolean => {
    const now = Date.now();
    while (recent.length && now - recent[0] > 60_000) recent.shift();
    if (recent.length >= SEARCH_LIMIT_PER_MINUTE) return false;
    recent.push(now);
    return true;
  };

  const product = async (barcode: string): Promise<{ hit: SearchHit | null; uk: boolean } | Failure> => {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS.join(',')}`;
    const res = await getJson(fetchImpl, url, timeoutMs);
    if (res.status === 'error') return res;
    if (res.status < 200 || res.status >= 300 || !isObject(res.body) || res.body.status === 0) return { hit: null, uk: false };
    const draft = parseOffProduct(res.body);
    const fields = isObject(res.body.product) ? res.body.product : {};
    const uk = Array.isArray(fields.countries_tags) && fields.countries_tags.includes(UK);
    return {
      hit: draft?.name && draft.nutrients.kcal !== null ? { barcode, imageUrl: draft.imageUrl ?? null, draft } : null,
      uk,
    };
  };

  /** The search service finds barcodes; each is then loaded like a scanned product, UK products first. */
  const searchService = async (query: string): Promise<SearchHit[] | Failure | 'busy'> => {
    if (!takeSearchSlot()) return 'busy';
    const params = new URLSearchParams({ q: query, page_size: String(SEARCH_PAGE_SIZE), fields: 'code,product_name,brands' });
    const res = await getJson(fetchImpl, `${SEARCH_SERVICE}?${params}`, timeoutMs);
    if (res.status === 'error') return res;
    if (res.status < 200 || res.status >= 300 || !isObject(res.body) || !Array.isArray(res.body.hits)) {
      return { status: 'error', reason: 'server' };
    }
    const codes = parseSearchServiceCodes(res.body).slice(0, PRODUCTS_PER_SEARCH);
    const loaded = await Promise.all(codes.map(product));
    const found = loaded.flatMap((r) => ('hit' in r && r.hit ? [r] : []));
    // Every product failed to load (e.g. the signal dropped): report why rather than "nothing found".
    const failure = loaded.find((r): r is Failure => 'status' in r);
    if (codes.length && !found.length && failure) return failure;
    return [...found.filter((r) => r.uk), ...found.filter((r) => !r.uk)].map((r) => r.hit!);
  };

  const searchFrom = async (host: 'uk' | 'world', query: string): Promise<SearchHit[] | Failure | 'busy'> => {
    if (!takeSearchSlot()) return 'busy';
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: String(SEARCH_PAGE_SIZE),
      sort_by: 'unique_scans_n',
      fields: FIELDS.join(','),
    });
    const res = await getJson(fetchImpl, `https://${host}.openfoodfacts.org/cgi/search.pl?${params}`, timeoutMs);
    if (res.status === 'error') return res;
    if (res.status < 200 || res.status >= 300) return { status: 'error', reason: 'server' };
    return parseOffSearch(res.body);
  };

  return {
    async search(raw: string): Promise<SearchResult> {
      const query = raw.trim().replace(/\s+/g, ' ');
      const key = query.toLowerCase();
      const cached = cache.get(key);
      if (cached) return { status: 'ok', hits: cached };
      let hits = await searchService(query);
      // The search service is down or can't be reached (no signal looks the same as its address not working):
      // try the older search, UK products first, then the whole world.
      if (!Array.isArray(hits) && hits !== 'busy' && hits.reason !== 'timeout') {
        hits = await searchFrom('uk', query);
        if (Array.isArray(hits) && hits.length === 0) hits = await searchFrom('world', query);
      }
      if (hits === 'busy') return { status: 'error', reason: 'busy' };
      if (!Array.isArray(hits)) return hits;
      cache.set(key, hits);
      return { status: 'ok', hits };
    },

    async lookup(barcode: string): Promise<LookupResult> {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS.join(',')}`;
      const res = await getJson(fetchImpl, url, timeoutMs);
      if (res.status === 'error') return res;
      if (res.status === 404) return { status: 'not_found' };
      if (res.status < 200 || res.status >= 300) return { status: 'error', reason: 'server' };
      if (isObject(res.body) && res.body.status === 0) return { status: 'not_found' };
      const draft = parseOffProduct(res.body);
      return draft ? { status: 'found', draft } : { status: 'not_found' };
    },
  };
}
