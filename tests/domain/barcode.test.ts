import { normaliseBarcode } from '@/domain/barcode';

test.each([
  ['5056000000017', '5056000000017'],
  [' 5056000000017 ', '5056000000017'],
  ['012345678905', '012345678905'],
  ['0012345678905', '012345678905'],
  ['96385074', '96385074'],
  ['05056000000017', '5056000000017'],
  ['5 056000 000017', '5056000000017'],
  ['5056-0000-00017', '5056000000017'],
  ['00012345678905', '012345678905'],
])('"%s" → %s', (raw, expected) => {
  expect(normaliseBarcode(raw)).toBe(expected);
});

test('a UPC-A read as 13 digits matches the 12-digit form', () => {
  expect(normaliseBarcode('0012345678905')).toBe(normaliseBarcode('012345678905'));
});

test.each(['', 'abc', '1234567', '123456789012345', 'https://example.com'])('"%s" is not a food barcode', (raw) => {
  expect(normaliseBarcode(raw)).toBeNull();
});
