import { COMMON_FOODS, getCommonFood, measureLabel, searchCommonFoods } from '@/domain/commonFoods';

test('every common food has a unique id, a measure, and complete values', () => {
  expect(new Set(COMMON_FOODS.map((f) => f.id)).size).toBe(COMMON_FOODS.length);
  for (const f of COMMON_FOODS) {
    expect(f.measures.length).toBeGreaterThan(0);
    for (const m of f.measures) expect(m.grams).toBeGreaterThan(0);
    expect(f.per100.kcal).not.toBeNull();
    expect(f.per100.proteinG).not.toBeNull();
  }
});

// Catches typos: calories should match protein, carbs, fat and fibre (4, 4, 9, 2 kcal per gram), within reason.
// Drinks with alcohol get their energy from it, so they're left out.
test.each(COMMON_FOODS.filter((f) => !['lager', 'red-wine'].includes(f.id)).map((f) => [f.name, f] as const))(
  '%s: calories agree with its protein, carbs and fat',
  (_name, f) => {
    const { kcal, proteinG, carbsG, fatG, fibreG } = f.per100;
    const fromMacros = 4 * proteinG! + 4 * carbsG! + 9 * fatG! + 2 * (fibreG ?? 0);
    expect(Math.abs(fromMacros - kcal!)).toBeLessThanOrEqual(Math.max(12, kcal! * 0.15));
  },
);

test('search puts names starting with the words first, and finds aliases', () => {
  expect(
    searchCommonFoods('egg')
      .map((f) => f.name)
      .slice(0, 2),
  ).toEqual(['Egg', 'Egg white']);
  expect(searchCommonFoods('blueb').map((f) => f.id)).toEqual(['blueberries']);
  expect(searchCommonFoods('berries').map((f) => f.id)).toEqual(
    expect.arrayContaining(['blueberries', 'raspberries', 'strawberries']),
  );
  expect(searchCommonFoods('beer').map((f) => f.id)).toEqual(['lager']);
  expect(searchCommonFoods('b')).toEqual([]);
  expect(searchCommonFoods('latte')[0].id).toBe('latte');
  expect(searchCommonFoods('coffee').map((f) => f.id)).toEqual(
    expect.arrayContaining(['latte', 'cappuccino', 'flat-white', 'americano']),
  );
});

test('carbs exclude fibre, as on UK labels', () => {
  expect(getCommonFood('blueberries')!.per100).toMatchObject({ carbsG: 12.1, fibreG: 2.4 });
});

test('measures read naturally', () => {
  const blueberries = getCommonFood('blueberries')!;
  expect(measureLabel(blueberries, blueberries.measures[0])).toBe('1 cup · 148 g');
  const milk = getCommonFood('semi-skimmed-milk')!;
  expect(measureLabel(milk, milk.measures[0])).toBe('1 glass · 200 ml');
});
