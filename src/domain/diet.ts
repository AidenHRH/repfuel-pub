/** What a food contains that some diets avoid. */
export type DietTag = 'meat' | 'fish' | 'dairy' | 'egg' | 'gluten' | 'honey';

/** The owner's eating style for meal plans. */
export type DietPrefs = {
  style: 'any' | 'vegetarian' | 'pescatarian' | 'vegan';
  dairyFree: boolean;
  glutenFree: boolean;
  /** Plan with the owner's own saved meals as well as RepFuel's simple meals. */
  useMyMeals: boolean;
};

export const DEFAULT_DIET: DietPrefs = { style: 'any', dairyFree: false, glutenFree: false, useMyMeals: true };

export const DIET_STYLE_LABELS: Record<DietPrefs['style'], string> = {
  any: 'Anything',
  vegetarian: 'Vegetarian',
  pescatarian: 'Pescatarian',
  vegan: 'Vegan',
};

/** Which common foods (by id) contain what. Anything not listed contains none of these. */
export const CONTAINS: Record<string, DietTag[]> = {
  'chicken-breast': ['meat'],
  'chicken-thigh': ['meat'],
  salmon: ['fish'],
  'tuna-can': ['fish'],
  prawns: ['fish'],
  egg: ['egg'],
  'egg-white': ['egg'],
  'greek-yoghurt-0': ['dairy'],
  'cottage-cheese': ['dairy'],
  cheddar: ['dairy'],
  'semi-skimmed-milk': ['dairy'],
  'whole-milk': ['dairy'],
  'skimmed-milk': ['dairy'],
  butter: ['dairy'],
  latte: ['dairy'],
  cappuccino: ['dairy'],
  'flat-white': ['dairy'],
  'tea-with-milk': ['dairy'],
  'hot-chocolate': ['dairy'],
  'milk-chocolate': ['dairy'],
  croissant: ['gluten', 'dairy', 'egg'],
  digestive: ['gluten', 'dairy'],
  'wholemeal-bread': ['gluten'],
  'white-bread': ['gluten'],
  bagel: ['gluten'],
  'tortilla-wrap': ['gluten'],
  pasta: ['gluten'],
  cornflakes: ['gluten'],
  granola: ['gluten'],
  // Oats are often grown and milled alongside wheat; only certified gluten-free oats are safe.
  oats: ['gluten'],
  lager: ['gluten'],
  'chicken-breast-raw': ['meat'],
  'turkey-mince': ['meat'],
  'beef-mince-5': ['meat'],
  'chicken-stock': ['meat'],
  'salmon-raw': ['fish'],
  'pasta-dry': ['gluten'],
  'couscous-dry': ['gluten'],
  'egg-noodles-dry': ['gluten', 'egg'],
  panko: ['gluten'],
  'soy-sauce': ['gluten'],
  'mozzarella-light': ['dairy'],
  feta: ['dairy'],
  parmesan: ['dairy'],
  pesto: ['dairy'],
  'whey-protein': ['dairy'],
  honey: ['honey'],
};

/** What a diet leaves out. */
export function excludedBy(prefs: Pick<DietPrefs, 'style' | 'dairyFree' | 'glutenFree'>): Set<DietTag> {
  const out = new Set<DietTag>();
  if (prefs.style === 'vegetarian' || prefs.style === 'pescatarian' || prefs.style === 'vegan') out.add('meat');
  if (prefs.style === 'vegetarian' || prefs.style === 'vegan') out.add('fish');
  if (prefs.style === 'vegan') ['dairy', 'egg', 'honey'].forEach((t) => out.add(t as DietTag));
  if (prefs.dairyFree) out.add('dairy');
  if (prefs.glutenFree) out.add('gluten');
  return out;
}

/** True when nothing in `tags` is left out by the diet. */
export function fitsDiet(tags: Iterable<DietTag>, excluded: Set<DietTag>): boolean {
  for (const t of tags) if (excluded.has(t)) return false;
  return true;
}

/** "Vegetarian · dairy-free", or "Anything". */
export function dietSummary(prefs: DietPrefs): string {
  const parts = [DIET_STYLE_LABELS[prefs.style]];
  if (prefs.dairyFree && prefs.style !== 'vegan') parts.push('dairy-free');
  if (prefs.glutenFree) parts.push('gluten-free');
  return parts.join(' · ');
}
