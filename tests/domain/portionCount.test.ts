import { portionCount } from '@/domain/format';

describe('portionCount', () => {
  test('quarters read as fractions however many portions there are', () => {
    expect(portionCount(4.5)).toBe('4½');
    expect(portionCount(5.25)).toBe('5¼');
    expect(portionCount(0.75)).toBe('¾');
    expect(portionCount(6)).toBe('6');
  });

  test('other amounts keep up to two decimals', () => {
    expect(portionCount(1.6)).toBe('1.6');
  });
});
