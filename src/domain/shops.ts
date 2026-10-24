/** UK shops offered when asking "Where's this from?". */
export const SHOPS = [
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
] as const;

const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim();

/** Names Open Food Facts' stores use, and own brands, to the shop. Own brands that are just the shop's name included. */
const STORE_NAMES: Record<string, (typeof SHOPS)[number]> = {
  tesco: 'Tesco',
  'tesco express': 'Tesco',
  sainsburys: 'Sainsbury’s',
  asda: 'Asda',
  morrisons: 'Morrisons',
  aldi: 'Aldi',
  lidl: 'Lidl',
  'co op': 'Co-op',
  coop: 'Co-op',
  'the co operative': 'Co-op',
  waitrose: 'Waitrose',
  'm&s': 'M&S',
  'm & s': 'M&S',
  'marks & spencer': 'M&S',
  'marks and spencer': 'M&S',
  iceland: 'Iceland',
  ocado: 'Ocado',
  booths: 'Booths',
};

// Supermarkets' own brands. A builder's list: extend it as new ones turn up.
const OWN_BRANDS: Record<string, (typeof SHOPS)[number]> = {
  'ashfield farm': 'Aldi',
  'specially selected': 'Aldi',
  brooklea: 'Aldi',
  'harvest morn': 'Aldi',
  cowbelle: 'Aldi',
  'the deli': 'Aldi',
  birchwood: 'Lidl',
  deluxe: 'Lidl',
  milbona: 'Lidl',
  crownfield: 'Lidl',
  'chef select': 'Lidl',
  'hearty food co': 'Tesco',
  'tesco finest': 'Tesco',
  'taste the difference': 'Sainsbury’s',
  'by sainsburys': 'Sainsbury’s',
  'extra special': 'Asda',
  'just essentials': 'Asda',
  'the best': 'Morrisons',
  'essential waitrose': 'Waitrose',
  'waitrose duchy organic': 'Waitrose',
  'co op irresistible': 'Co-op',
  ...STORE_NAMES,
};

/** The shop a product is from: its own brand first, else the first known UK shop in Open Food Facts' stores. */
export function shopFor(brand: string | null, stores: string | null): string | null {
  const own = brand ? OWN_BRANDS[key(brand)] : undefined;
  if (own) return own;
  for (const store of (stores ?? '').split(',')) {
    const shop = STORE_NAMES[key(store)];
    if (shop) return shop;
  }
  return null;
}
