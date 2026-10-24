import { TAKEAWAY_CUISINES, TAKEAWAYS } from '@/data/takeaways';

test('the eight UK takeaways, in order', () => {
  expect(TAKEAWAY_CUISINES).toEqual(['Chinese', 'Indian', 'Pizza', 'Chippy', 'Kebab', 'Burger', 'Italian', 'Thai']);
});

test('every cuisine has at least six dishes, every size all four values above 0', () => {
  for (const cuisine of TAKEAWAY_CUISINES) {
    const dishes = TAKEAWAYS.filter((d) => d.cuisine === cuisine);
    expect(dishes.length).toBeGreaterThanOrEqual(6);
    for (const d of dishes)
      for (const s of d.sizes) {
        expect(s.kcal).toBeGreaterThan(0);
        expect(s.proteinG).toBeGreaterThan(0);
        expect(s.carbsG).toBeGreaterThan(0);
        expect(s.fatG).toBeGreaterThan(0);
      }
  }
});

test('ids are unique; pizza is by the slice, the rest half / regular / large', () => {
  expect(new Set(TAKEAWAYS.map((d) => d.id)).size).toBe(TAKEAWAYS.length);
  for (const d of TAKEAWAYS)
    expect(d.sizes.map((s) => s.label)).toEqual(d.cuisine === 'Pizza' ? ['1 slice'] : ['Half', 'Regular', 'Large']);
});

test('calories roughly agree with the macros (4/4/9 kcal per g)', () => {
  for (const d of TAKEAWAYS)
    for (const s of d.sizes) {
      const fromMacros = s.proteinG * 4 + s.carbsG * 4 + s.fatG * 9;
      expect(Math.abs(fromMacros - s.kcal) / s.kcal).toBeLessThan(0.2);
    }
});
