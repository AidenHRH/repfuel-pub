import { rankHits } from '@/domain/searchRank';

const hit = (
  name: string,
  brand: string | null = null,
  extra: { kcal?: number | null; proteinG?: number | null; image?: boolean } = {},
) => ({
  barcode: null,
  imageUrl: extra.image === false ? null : 'https://images.openfoodfacts.org/x.jpg',
  draft: {
    name,
    brand,
    basis: 'per_100g' as const,
    servingSize: 40,
    nutrients: {
      kcal: extra.kcal === undefined ? 500 : extra.kcal,
      proteinG: extra.proteinG === undefined ? 6 : extra.proteinG,
      carbsG: 60,
      fatG: 25,
      fibreG: 2,
    },
    missing: [],
  },
});

const names = (hits: ReturnType<typeof hit>[]) => hits.map((h) => h.draft.name);

test('a name that starts with what you typed comes first', () => {
  const hits = [hit('Chocolate wafer KitKat style'), hit('KitKat 4 Finger', 'Nestlé'), hit('Kit Kat Chunky')];
  expect(names(rankHits(hits, 'kitkat'))[0]).toBe('KitKat 4 Finger');
});

test('every word you typed must be there to rank high, in the name or the brand', () => {
  const hits = [hit('Chunky bar'), hit('KitKat Chunky', 'Nestlé'), hit('KitKat 4 Finger', 'Nestlé')];
  expect(names(rankHits(hits, 'kitkat chunky'))).toEqual(['KitKat Chunky', 'KitKat 4 Finger', 'Chunky bar']);
  expect(names(rankHits([hit('Dark chocolate', 'Lindt'), hit('Lindor', 'Lindt')], 'lindt dark'))[0]).toBe('Dark chocolate');
});

test('complete nutrition and a picture break ties; otherwise the search order is kept', () => {
  const hits = [hit('Oat bar', null, { proteinG: null }), hit('Oat bar', null, { image: false }), hit('Oat bar')];
  expect(rankHits(hits, 'oat bar')).toEqual([hits[2], hits[1], hits[0]]);
  const same = [hit('Oat bar A'), hit('Oat bar B')];
  expect(rankHits(same, 'oat bar')).toEqual(same);
});
