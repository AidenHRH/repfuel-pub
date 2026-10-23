import { effortHaptic, effortShake, levelAt } from '@/domain/effort';

test('sliding along the bars: the level under the thumb, 1 at the left to 10 at the right', () => {
  expect(levelAt(0, 300)).toBe(1);
  expect(levelAt(29, 300)).toBe(1);
  expect(levelAt(30, 300)).toBe(2);
  expect(levelAt(150, 300)).toBe(6);
  expect(levelAt(299, 300)).toBe(10);
  // Past either end stays at the end.
  expect(levelAt(-40, 300)).toBe(1);
  expect(levelAt(420, 300)).toBe(10);
  expect(levelAt(10, 0)).toBe(1);
});

test('the harder it was, the stronger the tick and the shake', () => {
  expect([1, 3, 4, 7, 8, 10].map(effortHaptic)).toEqual(['light', 'light', 'medium', 'medium', 'heavy', 'heavy']);
  expect(effortShake(4)).toBe(0);
  expect(effortShake(5)).toBeGreaterThan(0);
  expect(effortShake(10)).toBeGreaterThan(effortShake(7));
  expect(effortShake(10)).toBeLessThanOrEqual(4);
});
