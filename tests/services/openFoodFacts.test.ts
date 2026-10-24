import fs from 'fs';
import path from 'path';

import { createOpenFoodFactsProvider, parseOffProduct, parseSearchServiceCodes } from '@/services/food-provider/openFoodFacts';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', `off-${name}.json`), 'utf8'));

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('parseOffProduct', () => {
  test('a full product becomes a per-100 g draft with the first brand', () => {
    expect(parseOffProduct(fixture('whey'))).toEqual({
      name: 'Whey Protein Chocolate',
      brand: 'Test Nutrition',
      basis: 'per_100g',
      servingSize: 25,
      packSize: null,
      nutrients: { kcal: 400, proteinG: 76, carbsG: 9.2, fatG: 6.1, fibreG: 1.4, sugarG: null },
      missing: ['sugarG'],
    });
  });

  test('missing nutrients stay unknown and are listed, never zero', () => {
    const draft = parseOffProduct(fixture('partial'))!;
    expect(draft.nutrients).toEqual({ kcal: 450, proteinG: null, carbsG: null, fatG: 18, fibreG: null, sugarG: null });
    expect(draft.missing).toEqual(['proteinG', 'carbsG', 'fibreG', 'sugarG']);
    expect(draft.brand).toBeNull();
  });

  test('drinks sold by volume are per 100 ml', () => {
    const draft = parseOffProduct(fixture('milk'))!;
    expect(draft).toMatchObject({ name: 'Semi Skimmed Milk', basis: 'per_100ml' });
  });

  test('blank values in the database stay unknown, not zero', () => {
    const json = {
      product: { product_name: 'Oddity', nutriments: { 'energy-kcal_100g': '', proteins_100g: ' ', fat_100g: '3.5' } },
    };
    expect(parseOffProduct(json)!.nutrients).toMatchObject({ kcal: null, proteinG: null, fatG: 3.5 });
  });

  test('kJ alone is not converted: calories stay unknown', () => {
    const json = { product: { product_name: 'Tea', nutriments: { 'energy-kj_100g': 4, proteins_100g: 0 } } };
    expect(parseOffProduct(json)!.nutrients.kcal).toBeNull();
  });

  test('nothing usable gives null', () => {
    expect(parseOffProduct({ product: {} })).toBeNull();
    expect(parseOffProduct('nonsense')).toBeNull();
  });
});

describe('Open Food Facts provider', () => {
  test('looks up the v2 endpoint and identifies the app', async () => {
    const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) => response(200, fixture('whey')));
    const provider = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch);
    const result = await provider.lookup('5056000000017');
    expect(result.status).toBe('found');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/5056000000017\?fields=/);
    expect((init!.headers as Record<string, string>)['User-Agent']).toMatch(/^RepFuel\/.+github\.com\/AidenHRH\/repfuel-pub/);
  });

  test('an unknown barcode is not_found (404 or status 0)', async () => {
    const p404 = createOpenFoodFactsProvider((async () => response(404, fixture('notfound'))) as unknown as typeof fetch);
    expect(await p404.lookup('1234567890128')).toEqual({ status: 'not_found' });
    const p200 = createOpenFoodFactsProvider((async () => response(200, fixture('notfound'))) as unknown as typeof fetch);
    expect(await p200.lookup('1234567890128')).toEqual({ status: 'not_found' });
  });

  test('no internet is reported as offline', async () => {
    const provider = createOpenFoodFactsProvider((async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch);
    expect(await provider.lookup('5056000000017')).toEqual({ status: 'error', reason: 'offline' });
  });

  test('Expo’s fetch reports no network as a plain Error: still offline', async () => {
    const provider = createOpenFoodFactsProvider((async () => {
      throw Object.assign(new Error('fetch failed: Unable to resolve host'), { name: 'Error' });
    }) as unknown as typeof fetch);
    expect(await provider.lookup('5056000000017')).toEqual({ status: 'error', reason: 'offline' });
  });

  test('a garbled response is a server problem', async () => {
    const provider = createOpenFoodFactsProvider(
      (async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        }) as unknown as Response) as unknown as typeof fetch,
    );
    expect(await provider.lookup('5056000000017')).toEqual({ status: 'error', reason: 'server' });
  });

  test('a server error is reported, not thrown', async () => {
    const provider = createOpenFoodFactsProvider((async () => response(503, {})) as unknown as typeof fetch);
    expect(await provider.lookup('5056000000017')).toEqual({ status: 'error', reason: 'server' });
  });

  test('a slow response times out, however the cancelled request is reported', async () => {
    jest.useFakeTimers();
    const fetchImpl = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('fetch failed: canceled')));
      });
    const provider = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch, 8000);
    const pending = provider.lookup('5056000000017');
    jest.advanceTimersByTime(8000);
    expect(await pending).toEqual({ status: 'error', reason: 'timeout' });
    jest.useRealTimers();
  });
});

describe('Open Food Facts search', () => {
  const kitkat = {
    code: '7613035239104',
    product_name: 'KitKat 4 Finger',
    brands: 'Nestlé, KitKat',
    quantity: '41.5 g',
    serving_quantity: '41.5',
    image_front_small_url: 'https://images.openfoodfacts.org/images/products/761/303/523/9104/front_en.200.jpg',
    nutriments: { 'energy-kcal_100g': 518, proteins_100g: 6.6, carbohydrates_100g: 60, fat_100g: 27, fiber_100g: 2 },
  };
  const noCalories = { code: '1', product_name: 'KitKat mystery', nutriments: { proteins_100g: 5 } };
  const noName = { code: '2', nutriments: { 'energy-kcal_100g': 500 } };

  const ukKitkat = {
    ...kitkat,
    code: '5000159461122',
    product_name: 'KitKat 4 Finger (UK)',
    countries_tags: ['en:united-kingdom'],
  };
  const products: Record<string, unknown> = {
    [kitkat.code]: kitkat,
    '1000001': noCalories,
    '1000002': noName,
    [ukKitkat.code]: ukKitkat,
  };

  /** A pretend Open Food Facts: the search service, product reads, and the older search. */
  function fakeOff({ service = 200, legacy = 200, serviceHits = [kitkat.code, '1000001', '1000002'] } = {}) {
    return jest.fn(async (url: string) => {
      if (url.startsWith('https://search.openfoodfacts.org/search?')) {
        return response(
          service,
          service === 200 ? { hits: serviceHits.map((code) => ({ code, product_name: 'x' })), count: serviceHits.length } : {},
        );
      }
      const read = url.match(/\/api\/v2\/product\/(\d+)\?/);
      if (read) return products[read[1]] ? response(200, { status: 1, product: products[read[1]] }) : response(404, {});
      if (url.includes('/cgi/search.pl?')) return response(legacy, legacy === 200 ? { products: [kitkat] } : {});
      throw new Error(`unexpected ${url}`);
    });
  }

  test("searches Open Food Facts' search service, then loads each match like a scanned product", async () => {
    const fetchImpl = fakeOff();
    const provider = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch);
    const result = await provider.search('  kitkat ');
    expect(result).toEqual({
      status: 'ok',
      hits: [
        {
          barcode: '7613035239104',
          imageUrl: kitkat.image_front_small_url,
          draft: {
            name: 'KitKat 4 Finger',
            brand: 'Nestlé',
            basis: 'per_100g',
            servingSize: 41.5,
            packSize: null,
            imageUrl: kitkat.image_front_small_url,
            nutrients: { kcal: 518, proteinG: 6.6, carbsG: 60, fatG: 27, fibreG: 2, sugarG: null },
            missing: ['sugarG'],
          },
        },
      ],
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('q=kitkat');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^RepFuel\//);
    expect(fetchImpl.mock.calls.some(([u]) => String(u).includes('cgi/search.pl'))).toBe(false);
  });

  test("UK products come first, otherwise the search service's order is kept", async () => {
    const provider = createOpenFoodFactsProvider(
      fakeOff({ serviceHits: [kitkat.code, ukKitkat.code] }) as unknown as typeof fetch,
    );
    const result = await provider.search('kitkat');
    expect(result.status === 'ok' && result.hits.map((h) => h.barcode)).toEqual([ukKitkat.code, kitkat.code]);
  });

  test('nothing found is an empty list, not an error', async () => {
    const fetchImpl = fakeOff({ serviceHits: [] });
    const provider = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch);
    expect(await provider.search('zzzz')).toEqual({ status: 'ok', hits: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('when the search service is down, the older search is tried', async () => {
    const provider = createOpenFoodFactsProvider(fakeOff({ service: 503 }) as unknown as typeof fetch);
    const result = await provider.search('kitkat');
    expect(result.status === 'ok' && result.hits.map((h) => h.draft.name)).toEqual(['KitKat 4 Finger']);
  });

  test('both searches down is a server problem', async () => {
    const provider = createOpenFoodFactsProvider(fakeOff({ service: 503, legacy: 503 }) as unknown as typeof fetch);
    expect(await provider.search('kitkat')).toEqual({ status: 'error', reason: 'server' });
  });

  test('search-service answers with odd codes are tolerated', () => {
    expect(
      parseSearchServiceCodes({ hits: [{ code: 7613035239104 }, { code: 'abc' }, {}, 'x', { code: '7613035239104' }] }),
    ).toEqual(['7613035239104']);
    expect(parseSearchServiceCodes({ nope: true })).toEqual([]);
  });

  test('the same search again is answered from memory', async () => {
    const fetchImpl = fakeOff();
    const provider = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch);
    await provider.search('kitkat');
    const calls = fetchImpl.mock.calls.length;
    await provider.search('KitKat');
    expect(fetchImpl).toHaveBeenCalledTimes(calls);
  });

  test('searching too often waits instead of risking a ban', async () => {
    const fetchImpl = fakeOff();
    const provider = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch);
    for (let i = 0; i < 8; i++) await provider.search(`food ${i}`);
    expect(await provider.search('one more')).toEqual({ status: 'error', reason: 'busy' });
    const searches = fetchImpl.mock.calls.filter(([u]) => String(u).startsWith('https://search.openfoodfacts.org/'));
    expect(searches).toHaveLength(8);
  });

  test('no signal comes back as an error, never thrown', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    const offline = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch);
    expect(await offline.search('kitkat')).toEqual({ status: 'error', reason: 'offline' });
  });

  test("if the search service can't be reached at all, the older search still gets a go", async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.startsWith('https://search.openfoodfacts.org/')) throw new Error('Network request failed');
      return response(200, { products: [kitkat] });
    });
    const provider = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch);
    const result = await provider.search('kitkat');
    expect(result.status === 'ok' && result.hits.length).toBe(1);
  });

  test('the signal dropping while products load is reported, not shown as "nothing found"', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.startsWith('https://search.openfoodfacts.org/')) return response(200, { hits: [{ code: kitkat.code }] });
      throw new Error('Network request failed');
    });
    const provider = createOpenFoodFactsProvider(fetchImpl as unknown as typeof fetch);
    expect(await provider.search('kitkat')).toEqual({ status: 'error', reason: 'offline' });
  });

  test('barcode lookups keep the product picture too', async () => {
    const provider = createOpenFoodFactsProvider((async () =>
      response(200, { status: 1, product: kitkat })) as unknown as typeof fetch);
    const result = await provider.lookup('7613035239104');
    expect(result.status === 'found' && result.draft.imageUrl).toBe(kitkat.image_front_small_url);
  });
});

describe('health information', () => {
  const product = (extra: Record<string, unknown>) => ({
    product: { product_name: 'Bar', nutriments: { 'energy-kcal_100g': 500, proteins_100g: 5 }, ...extra },
  });

  test('Nutri-Score, processing level and additives come through', () => {
    const draft = parseOffProduct(
      product({ nutriscore_grade: 'E', nova_group: 4, additives_tags: ['en:e322i', 'en:e476', 'oops'] }),
    )!;
    expect(draft.health).toEqual({ nutriscore: 'e', nova: 4, additives: ['E322i', 'E476'] });
  });

  test('missing or nonsense values are left unknown, and no health at all when nothing is known', () => {
    expect(parseOffProduct(product({ nutriscore_grade: 'unknown', nova_group: '4' }))!.health).toEqual({
      nutriscore: null,
      nova: 4,
      additives: [],
    });
    expect(parseOffProduct(product({ nutriscore_grade: 'not-applicable', nova_group: 9 }))!.health).toBeUndefined();
  });
});

describe('pack size', () => {
  const product = (extra: Record<string, unknown>) => ({
    product: { product_name: 'Fusilli', nutriments: { 'energy-kcal_100g': 359, proteins_100g: 12 }, ...extra },
  });

  test('the pack size comes through in the food’s own unit', () => {
    expect(parseOffProduct(product({ product_quantity: 500, product_quantity_unit: 'g' }))!.packSize).toBe(500);
    expect(parseOffProduct(product({ product_quantity: '300', quantity: '300 g' }))!.packSize).toBe(300);
    expect(parseOffProduct(product({ product_quantity: 1.5, product_quantity_unit: 'kg' }))!.packSize).toBe(1500);
    expect(parseOffProduct(product({ product_quantity: 2, product_quantity_unit: 'l' }))!.packSize).toBe(2000);
  });

  test('an unknown or unusable pack size stays unknown', () => {
    expect(parseOffProduct(product({}))!.packSize).toBeNull();
    expect(parseOffProduct(product({ product_quantity: 0, product_quantity_unit: 'g' }))!.packSize).toBeNull();
    expect(parseOffProduct(product({ product_quantity: 6, product_quantity_unit: 'pieces' }))!.packSize).toBeNull();
  });
});

describe('sugar', () => {
  test('sugar per 100 g is read as a secondary nutrient', () => {
    const draft = parseOffProduct({ product: { product_name: 'Maltesers', nutriments: { 'energy-kcal_100g': 498, sugars_100g: 52 } } })!;
    expect(draft.nutrients.sugarG).toBe(52);
  });

  test('no sugar listed stays unknown', () => {
    const draft = parseOffProduct({ product: { product_name: 'Oats', nutriments: { 'energy-kcal_100g': 379 } } })!;
    expect(draft.nutrients.sugarG).toBeNull();
  });
});

test('the shop comes from Open Food Facts’ stores, or the brand when it’s an own brand', () => {
  const at = (brands: string, stores?: string) =>
    parseOffProduct({ product: { product_name: 'Thighs', brands, stores, nutriments: { 'energy-kcal_100g': 180 } } })!;
  expect(at('Ashfield Farm').shop).toBe('Aldi');
  expect(at('Corner Butchers', 'Booths, Tesco').shop).toBe('Booths');
  expect(at('Corner Butchers').shop).toBeUndefined();
});
