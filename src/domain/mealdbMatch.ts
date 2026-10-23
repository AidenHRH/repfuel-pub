import { getCommonFood, COMMON_FOODS } from './commonFoods';
import type { Nutrients } from './types';

/** A TheMealDB amount: grams (weights, and ml at 1 g/ml), spoons and cups, or a count of whole things. */
export type ParsedMeasure = { grams: number } | { count: number; unit: 'piece' | 'tsp' | 'tbsp' | 'cup' };

const VULGAR: Record<string, string> = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };

const GRAMS_PER: Record<string, number> = {
  g: 1,
  gr: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kgs: 1000,
  kilogram: 1000,
  kilograms: 1000,
  ml: 1,
  millilitre: 1,
  millilitres: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  litre: 1000,
  litres: 1000,
  liter: 1000,
  liters: 1000,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.6,
  lbs: 453.6,
  pound: 453.6,
  pounds: 453.6,
};

const SPOONS: Record<string, 'tsp' | 'tbsp' | 'cup'> = {
  tsp: 'tsp',
  tsps: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tbsps: 'tbsp',
  tbs: 'tbsp',
  tblsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cup: 'cup',
  cups: 'cup',
};

/** Millilitres in a spoon or cup, used when the food has no measure of its own for it. */
const SPOON_ML = { tsp: 5, tbsp: 15, cup: 240 };

const round1 = (x: number) => Math.round(x * 10) / 10;

/** "1/2 cup" → 0.5 cup, "400g tin" → 400 g, "3 cloves" → 3 pieces; "Pinch", "to taste" and blanks → null. */
export function parseMeasure(text: string): ParsedMeasure | null {
  let s = text.toLowerCase();
  for (const [v, r] of Object.entries(VULGAR)) s = s.split(v).join(r);
  const m = s.trim().match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?(?:\/(\d+))?\s*([a-z]*)/);
  if (!m) return null;
  let count = Number(m[1]);
  if (m[2] && m[3]) count += Number(m[2]) / Number(m[3]);
  if (m[4]) count /= Number(m[4]);
  if (!(count > 0)) return null;
  const unit = m[5];
  if (unit in GRAMS_PER) return { grams: round1(count * GRAMS_PER[unit]) };
  if (unit in SPOONS) return { count, unit: SPOONS[unit] };
  return { count, unit: 'piece' };
}

/** TheMealDB names (lowercase, singular) for built-in foods whose names differ. */
const ALIASES: Record<string, string> = {
  'chicken breast': 'chicken-breast-raw',
  chicken: 'chicken-breast-raw',
  'chicken thigh': 'chicken-thigh',
  rice: 'white-rice-dry',
  'basmati rice': 'white-rice-dry',
  'long grain rice': 'white-rice-dry',
  'white rice': 'white-rice-dry',
  'jasmine rice': 'white-rice-dry',
  'brown rice': 'brown-rice',
  spaghetti: 'pasta-dry',
  pasta: 'pasta-dry',
  penne: 'pasta-dry',
  'penne rigate': 'pasta-dry',
  fusilli: 'pasta-dry',
  linguine: 'pasta-dry',
  tagliatelle: 'pasta-dry',
  macaroni: 'pasta-dry',
  couscous: 'couscous-dry',
  'egg noodle': 'egg-noodles-dry',
  noodle: 'egg-noodles-dry',
  'minced beef': 'beef-mince-5',
  'beef mince': 'beef-mince-5',
  'ground beef': 'beef-mince-5',
  'minced turkey': 'turkey-mince',
  'ground turkey': 'turkey-mince',
  'salmon fillet': 'salmon-raw',
  salmon: 'salmon-raw',
  tuna: 'tuna-can',
  'king prawn': 'prawns',
  prawn: 'prawns',
  'red onion': 'onion',
  'garlic clove': 'garlic',
  oil: 'olive-oil',
  'vegetable oil': 'olive-oil',
  'sunflower oil': 'olive-oil',
  'extra virgin olive oil': 'olive-oil',
  'unsalted butter': 'butter',
  milk: 'semi-skimmed-milk',
  'chopped tomato': 'chopped-tomatoes',
  'tinned tomato': 'chopped-tomatoes',
  'canned tomato': 'chopped-tomatoes',
  'tomato puree': 'tomato-puree',
  'tomato paste': 'tomato-puree',
  'cherry tomato': 'tomato',
  'red pepper': 'red-pepper',
  'pepper red': 'red-pepper',
  'bell pepper': 'red-pepper',
  'green pepper': 'red-pepper',
  'sweet potato': 'sweet-potato',
  'spring onion': 'spring-onion',
  scallion: 'spring-onion',
  'frozen pea': 'peas',
  pea: 'peas',
  mushroom: 'mushrooms',
  'parmesan cheese': 'parmesan',
  'cheddar cheese': 'cheddar',
  mozzarella: 'mozzarella-light',
  'feta cheese': 'feta',
  chickpea: 'chickpeas',
  'kidney bean': 'kidney-beans',
  'red kidney bean': 'kidney-beans',
  'black bean': 'black-beans',
  'red lentil': 'lentils',
  lentil: 'lentils',
  'coconut milk': 'coconut-milk-light',
  'chicken stock': 'chicken-stock',
  'cumin seed': 'cumin',
  'ground cumin': 'cumin',
  'ground cinnamon': 'cinnamon',
  'chilli powder': 'chilli-powder',
  'chili powder': 'chilli-powder',
  'smoked paprika': 'paprika',
  'greek yogurt': 'greek-yoghurt-0',
  'greek yoghurt': 'greek-yoghurt-0',
  'rolled oat': 'oats',
  oat: 'oats',
  carrot: 'carrot',
  potato: 'potato',
  tortilla: 'tortilla-wrap',
  'flour tortilla': 'tortilla-wrap',
  breadcrumb: 'panko',
  'panko breadcrumb': 'panko',
};

/** Ingredients with next to no calories: counted as nothing rather than left unknown. */
const NEGLIGIBLE = new Set(['salt', 'pepper', 'black pepper', 'water', 'ice', 'sea salt', 'salt and pepper', 'cold water']);

const singular = (w: string) =>
  w.endsWith('oes')
    ? w.slice(0, -2)
    : w.endsWith('ies')
      ? `${w.slice(0, -3)}y`
      : w.endsWith('s') && !w.endsWith('ss')
        ? w.slice(0, -1)
        : w;

const byName = new Map(COMMON_FOODS.map((f) => [f.name.toLowerCase(), f.id]));

/** The built-in food for a TheMealDB ingredient name ("Chicken Breasts" → raw chicken breast), or null. */
export function matchIngredient(name: string): string | null {
  const plain = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!plain) return null;
  const one = plain.split(' ').map(singular).join(' ');
  return ALIASES[one] ?? ALIASES[plain] ?? byName.get(plain) ?? byName.get(one) ?? null;
}

export type MealDbIngredient = { name: string; measure: string };

export type Estimate = {
  /** For the whole recipe; null where nothing was counted. */
  nutrients: Nutrients;
  counted: string[];
  notCounted: string[];
};

function gramsOf(foodId: string, m: ParsedMeasure): number | null {
  if ('grams' in m) return m.grams;
  const food = getCommonFood(foodId);
  if (!food) return null;
  if (m.unit === 'piece') {
    // The food's own whole-thing size ("1 medium", "1 clove"); pack and portion sizes are not a piece.
    const own = food.measures.find((x) => !/pack|portion|tin|cup|tbsp|tsp|handful/.test(x.label));
    return own ? m.count * own.grams : null;
  }
  const own = food.measures.find((x) => x.label === `1 ${m.unit}`);
  return m.count * (own ? own.grams : SPOON_ML[m.unit]);
}

/** How a recipe's ingredients matched: each counted one with its built-in food and grams (none for salt and the like). */
export function matchIngredients(ingredients: MealDbIngredient[]): {
  matched: { name: string; foodId: string | null; grams: number }[];
  notCounted: string[];
} {
  const matched: { name: string; foodId: string | null; grams: number }[] = [];
  const notCounted: string[] = [];
  for (const ing of ingredients) {
    if (NEGLIGIBLE.has(ing.name.trim().toLowerCase())) {
      matched.push({ name: ing.name, foodId: null, grams: 0 });
      continue;
    }
    const id = matchIngredient(ing.name);
    const m = parseMeasure(ing.measure);
    const grams = id && m ? gramsOf(id, m) : null;
    if (!id || grams === null || getCommonFood(id)?.per100.kcal == null) notCounted.push(ing.name);
    else matched.push({ name: ing.name, foodId: id, grams });
  }
  return { matched, notCounted };
}

/** Estimated macros for a TheMealDB recipe: matched and measured ingredients are counted; the rest are listed. */
export function estimate(ingredients: MealDbIngredient[]): Estimate {
  const { matched, notCounted } = matchIngredients(ingredients);
  const total = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 };
  let fibreKnown = true;
  let any = false;
  for (const { foodId, grams } of matched) {
    const food = foodId ? getCommonFood(foodId) : null;
    if (!food) continue;
    const f = grams / 100;
    total.kcal += (food.per100.kcal ?? 0) * f;
    total.proteinG += (food.per100.proteinG ?? 0) * f;
    total.carbsG += (food.per100.carbsG ?? 0) * f;
    total.fatG += (food.per100.fatG ?? 0) * f;
    if (food.per100.fibreG === null) fibreKnown = false;
    else total.fibreG += food.per100.fibreG * f;
    any = true;
  }
  const nutrients: Nutrients = any
    ? { ...total, fibreG: fibreKnown ? total.fibreG : null }
    : { kcal: null, proteinG: null, carbsG: null, fatG: null, fibreG: null };
  return { nutrients, counted: matched.map((m) => m.name), notCounted };
}
