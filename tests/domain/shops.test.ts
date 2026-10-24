import { SHOPS, shopFor } from '@/domain/shops';

test('an own brand names its shop', () => {
  expect(shopFor('Ashfield Farm', null)).toBe('Aldi');
  expect(shopFor('Birchwood', null)).toBe('Lidl');
  expect(shopFor('Taste the Difference', null)).toBe('Sainsbury’s');
  expect(shopFor('  specially selected ', null)).toBe('Aldi');
});

test('Open Food Facts’ stores: the first known UK shop, tidied', () => {
  expect(shopFor(null, "tesco,Sainsbury's , ASDA")).toBe('Tesco');
  expect(shopFor(null, 'Corner shop, ALDI')).toBe('Aldi');
  expect(shopFor(null, 'Marks & Spencer')).toBe('M&S');
});

test('unknown text gives no shop, never a made-up one', () => {
  expect(shopFor(null, 'Corner shop')).toBeNull();
  expect(shopFor('Cadbury', null)).toBeNull();
  expect(shopFor(null, '')).toBeNull();
});

test('an own brand beats the stores list', () => {
  expect(shopFor('Birchwood', 'Tesco')).toBe('Lidl');
});

test('the shops to choose from', () => {
  expect(SHOPS).toEqual([
    'Tesco',
    'Sainsbury’s',
    'Asda',
    'Morrisons',
    'Aldi',
    'Lidl',
    'Co-op',
    'Waitrose',
    'M&S',
    'Iceland',
    'Ocado',
    'Booths',
  ]);
});
