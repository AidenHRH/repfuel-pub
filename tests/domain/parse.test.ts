import { parseAmount, parseDuration } from '@/domain/parse';

test.each([
  ['30', 30],
  [' 12,5 ', 12.5],
  ['0.75', 0.75],
  ['0', 0],
])('"%s" parses to %s', (text, expected) => {
  expect(parseAmount(text)).toBe(expected);
});

test('blank means unknown', () => {
  expect(parseAmount('')).toBeNull();
  expect(parseAmount('   ')).toBeNull();
});

test.each(['abc', '-1', '1e3', '1.2.3', '12,5,1', 'Infinity'])('"%s" is invalid, never zero', (text) => {
  expect(parseAmount(text)).toBeNaN();
});

describe('parseDuration', () => {
  test.each([
    ['90', 90],
    ['1:30', 90],
    ['1:5', 65],
    ['01:30', 90],
    [' 2:00 ', 120],
  ])('"%s" is %s seconds', (text, seconds) => {
    expect(parseDuration(text)).toBe(seconds);
  });

  test('blank is unknown; nonsense and zero are rejected', () => {
    expect(parseDuration('')).toBeNull();
    for (const bad of ['2:75', 'abc', '0', '0:00', '1:30:00', '-5']) expect(parseDuration(bad)).toBeNaN();
  });
});
