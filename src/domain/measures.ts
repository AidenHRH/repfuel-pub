import { friendlyNumber } from './format';
import { parseAmount } from './parse';
import { getCommonFood, type Measure } from './commonFoods';
import { drinkMeasures, isDrink } from './drinks';
import type { NutritionBasis } from './types';

type Measurable = {
  basis: NutritionBasis;
  servingSize: number | null;
  presetId: string | null;
  packSize: number | null;
  /** One piece (a Malteser), when the owner has said how much one weighs. */
  pieceG?: number | null;
  pieceLabel?: string | null;
};

// Like "1 serving" and "1 can", so How many reads "0.5 × 1 pack".
const ONE_PACK = '1 pack';

/**
 * The sizes offered for a food weighed in g or ml: a built-in food's own measures (a cup, a large egg), a drink's
 * sizes, or the pack's serving; then the whole pack when its size is known and not already listed. Per-serving foods
 * are counted in servings, so they have none.
 */
export function foodMeasures(food: Measurable): Measure[] {
  if (food.basis === 'per_serving') return [];
  const preset = food.presetId ? getCommonFood(food.presetId) : null;
  const sizes: Measure[] = isDrink(food)
    ? drinkMeasures(food)
    : preset
      ? preset.measures
      : food.servingSize
        ? [{ label: '1 serving', grams: food.servingSize }]
        : [];
  const piece = food.pieceG ? [{ label: `1 ${food.pieceLabel || 'piece'}`, grams: food.pieceG }] : [];
  const all = [...piece, ...sizes];
  const pack = food.packSize;
  return pack && !all.some((m) => m.grams === pack) ? [...all, { label: ONE_PACK, grams: pack }] : all;
}

/** "150 g of a 300 g pack", when the pack size is known. */
export function packHint(amount: number, packSize: number | null, unit: 'g' | 'ml'): string | null {
  return packSize ? `${friendlyNumber(amount)} ${unit} of a ${friendlyNumber(packSize)} ${unit} pack` : null;
}

/** One piece's weight from the pack: a 175 g tub of 37. */
export function pieceFromPack(packG: number, count: number): number {
  return packG / count;
}

/** A typed piece weight or count: a number above 0, else null (blank, 0, negative or text). */
export function readPieceWeight(text: string): number | null {
  const n = parseAmount(text);
  return n !== null && Number.isFinite(n) && n > 0 ? n : null;
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };
// Sizes named by an adjective ("1 large" egg) or a unit don't take a plural.
const NO_PLURAL = new Set(['small', 'medium', 'large', 'tbsp', 'tsp', 'g', 'ml']);
const ADJECTIVE_SIZES = new Set(['small', 'medium', 'large']);

/** How many of `measure` an amount is, when it's a whole number of quarters (2, ½, 1¼); else null. */
export function countOf(amount: number, measure: Measure | null): number | null {
  if (!measure || measure.grams <= 0) return null;
  const n = amount / measure.grams;
  const quarters = Math.round(n * 4);
  return quarters > 0 && Math.abs(n * 4 - quarters) < 0.01 ? quarters / 4 : null;
}

const plural = (word: string) =>
  NO_PLURAL.has(word)
    ? word
    : /[^aeiou]y$/.test(word)
      ? `${word.slice(0, -1)}ies`
      : /(s|ch|sh|x)$/.test(word) || /(potato|tomato|mango)$/.test(word)
        ? `${word}es`
        : `${word}s`;

/**
 * "2 biscuits", "½ biscuit", "3 medium slices" for n of a size labelled "1 …". A size that's only an adjective
 * ("1 large") takes the food's name: "2 large eggs".
 */
export function countPhrase(n: number, measure: Measure, foodName?: string): string {
  const size = measure.label.replace(/^1\s+/, '');
  const noun = foodName ? singular(foodName.split(',')[0].trim().toLowerCase()) : '';
  const name = size.split(' ').every((w) => ADJECTIVE_SIZES.has(w.toLowerCase())) && noun ? `${size} ${noun}` : size;
  const whole = Math.floor(n);
  const part = FRACTIONS[String(Math.round((n - whole) * 100) / 100)] ?? '';
  const number = whole === 0 ? part || friendlyNumber(n) : part ? `${whole}${part}` : friendlyNumber(n);
  if (n <= 1) return `${number} ${name}`;
  const words = name.split(' ');
  words[words.length - 1] = plural(words[words.length - 1]);
  return `${number} ${words.join(' ')}`;
}

// Serving words that say nothing about a piece ("1 portion (250 ml)").
const NOT_A_PIECE = /^(serving|portion|pack|packet|bag|bottle|can|pot|tub|scoop|g|ml)$/;

const singular = (word: string) =>
  /ies$/.test(word)
    ? `${word.slice(0, -3)}y`
    : /(ches|shes|xes|sses)$/.test(word)
      ? word.slice(0, -2)
      : /[^s]s$/.test(word)
        ? word.slice(0, -1)
        : word;

/**
 * One piece from a pack's serving text, as Open Food Facts lists it: "2 biscuits (25 g)" → a biscuit is 12.5 g.
 * Null when the serving isn't counted in pieces ("30 g", "1 portion (250 ml)").
 */
export function parseServingSize(text: string | null | undefined): { label: string; grams: number } | null {
  const m = text?.trim().match(/^(\d+(?:[.,]\d+)?)\s+([a-z][a-z ]{0,24}?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*(g|ml)\s*\)/i);
  if (!m) return null;
  const count = Number(m[1].replace(',', '.'));
  const grams = Number(m[3].replace(',', '.'));
  const word = singular(m[2].trim().toLowerCase());
  if (!(count > 0) || !(grams > 0) || NOT_A_PIECE.test(word)) return null;
  return { label: word, grams: Math.round((grams / count) * 100) / 100 };
}
