import { validateTargets } from '@/domain/targets';

test('normal targets are accepted', () => {
  expect(validateTargets('2300', '150')).toEqual({ ok: true, caloriesKcal: 2300, proteinGrams: 150 });
});

test('a thousands separator is understood, not read as a decimal', () => {
  expect(validateTargets('2,500', '145')).toEqual({ ok: true, caloriesKcal: 2500, proteinGrams: 145 });
});

test.each([
  ['0', '145'],
  ['0.5', '145'],
  ['10001', '145'],
  ['2500', '0'],
  ['2500', '1001'],
  ['', '145'],
  ['abc', '145'],
])('rejects calories "%s" / protein "%s"', (kcal, protein) => {
  expect(validateTargets(kcal, protein).ok).toBe(false);
});
