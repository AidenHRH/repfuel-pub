import { getCommonFood } from './commonFoods';
import { friendlyNumber } from './format';
import { MEAL_LABELS } from './meals';
import type { MealTemplate, PlanSlot } from './mealTemplates';

/** A planned meal to prep for, `daysAhead` days after the prep day. */
export type PrepMeal = {
  day: string;
  daysAhead: number;
  dayLabel: string;
  slot: PlanSlot;
  portions: number;
  meal: { kind: 'template'; template: MealTemplate } | { kind: 'recipe'; id: string; name: string };
};

export type PrepStep = { key: string; title: string; detail: string };
export type PrepBox = {
  key: string;
  label: string;
  name: string;
  contents: string | null;
  /** What goes in on the day, for meals that would go soggy (wraps). */
  onTheDay: string | null;
  store: 'fridge' | 'freezer';
};
export type PrepSession = { steps: PrepStep[]; boxes: PrepBox[]; madeOnTheDay: { key: string; label: string; name: string }[] };

type Action = {
  order: number;
  title: string;
  note?: string;
  /** Cooked weight ÷ dry weight, to say how much to cook. */ swell?: number;
};

/** What prepping each built-in food involves, in the order to start them (longest first). Unlisted foods are packed as they are. */
const ACTIONS: Record<string, Action> = {
  'sweet-potato': { order: 1, title: 'Roast the sweet potato', note: 'in chunks' },
  potato: { order: 1, title: 'Bake the potatoes' },
  'brown-rice': { order: 2, title: 'Cook brown rice', swell: 2.5 },
  'white-rice': { order: 2, title: 'Cook white rice', swell: 2.5 },
  pasta: { order: 2, title: 'Cook pasta', swell: 2.2 },
  lentils: { order: 2, title: 'Cook lentils', swell: 2.5, note: 'or use tins, drained' },
  'chicken-breast': { order: 3, title: 'Cook the chicken', note: 'until steaming hot all the way through, with no pink meat' },
  salmon: { order: 3, title: 'Bake the salmon', note: 'until it flakes easily' },
  prawns: { order: 3, title: 'Cook the prawns', note: 'until pink all the way through' },
  broccoli: { order: 4, title: 'Steam the broccoli', note: 'keep it a little firm, it softens when reheated' },
  peas: { order: 4, title: 'Cook the peas' },
  chickpeas: { order: 5, title: 'Drain and rinse the chickpeas', note: 'a 400 g can gives about 240 g' },
  sweetcorn: { order: 5, title: 'Drain the sweetcorn' },
};
const CHOP = new Set(['red-pepper', 'cucumber', 'carrot', 'onion', 'tomato']);
// Meals with raw salad in them go limp and watery in the freezer.
const NO_FREEZER = new Set(['chickpea-salad', 'lentil-salad', 'hummus-veg-wrap', 'chicken-wrap']);
const RICE = new Set(['white-rice', 'brown-rice', 'white-rice-dry']);

const grams = (g: number) => `${g >= 50 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g))} g`;
// "White rice, cooked" reads as just "White rice" in a cooking session.
const nameOf = (food: string) => (getCommonFood(food)?.name ?? food).replace(/, (cooked|baked)$/, '');

/**
 * Turns the meals to prep into one cooking session: what to cook in total (in a sensible order), then which box
 * each meal goes in and whether it goes in the fridge or the freezer. Storage follows NHS advice: eat chilled
 * leftovers within 2 days, and cooked rice within 24 hours.
 */
export function prepSession(meals: PrepMeal[]): PrepSession {
  const totals = new Map<string, number>();
  const recipes = new Map<string, { name: string; portions: number }>();
  const boxes: PrepBox[] = [];
  const madeOnTheDay: PrepSession['madeOnTheDay'] = [];

  for (const m of meals) {
    const key = `${m.day}:${m.slot}`;
    const label = `${m.dayLabel} · ${MEAL_LABELS[m.slot]}`;
    const portions = m.portions === 1 ? '' : ` (${friendlyNumber(m.portions)} portions)`;
    if (m.meal.kind === 'recipe') {
      const r = recipes.get(m.meal.id) ?? { name: m.meal.name, portions: 0 };
      r.portions += m.portions;
      recipes.set(m.meal.id, r);
      boxes.push({
        key,
        label,
        name: `${m.meal.name}${portions}`,
        contents: null,
        onTheDay: null,
        store: m.daysAhead <= 2 ? 'fridge' : 'freezer',
      });
      continue;
    }
    const t = m.meal.template;
    // A batch recipe (made for several portions by its own method) is cooked once, following its steps.
    if (t.serves > 1 && t.prep === 'box') {
      const rice = t.ingredients.some((i) => RICE.has(i.food));
      const r = recipes.get(`template:${t.id}`) ?? { name: t.name, portions: 0 };
      r.portions += m.portions;
      recipes.set(`template:${t.id}`, r);
      boxes.push({
        key,
        label,
        name: `${t.name}${portions}`,
        contents: null,
        onTheDay: null,
        store: m.daysAhead <= (rice ? 1 : 2) ? 'fridge' : 'freezer',
      });
      continue;
    }
    if (t.prep === 'fresh') {
      madeOnTheDay.push({ key, label, name: t.name });
      continue;
    }
    const rice = t.ingredients.some((i) => RICE.has(i.food));
    const store = m.daysAhead <= (rice ? 1 : 2) ? 'fridge' : 'freezer';
    if (store === 'freezer' && NO_FREEZER.has(t.id)) {
      madeOnTheDay.push({ key, label, name: `${t.name} (too far ahead to keep)` });
      continue;
    }
    const packed: string[] = [];
    const later: string[] = [];
    for (const { food, grams: g } of t.ingredients) {
      const amount = g * m.portions;
      const cooked = !!ACTIONS[food] || CHOP.has(food);
      if (t.prep === 'parts' && !cooked) {
        later.push(nameOf(food));
        continue;
      }
      if (cooked) totals.set(food, (totals.get(food) ?? 0) + amount);
      packed.push(`${nameOf(food)} ${grams(amount)}`);
    }
    boxes.push({
      key,
      label,
      name: `${t.name}${portions}`,
      contents: packed.join(' · '),
      onTheDay: later.length ? `Add on the day: ${later.join(', ')}` : null,
      store,
    });
  }

  const steps: PrepStep[] = [];
  for (const [id, r] of recipes) {
    steps.push({
      key: `recipe:${id}`,
      title: `Make ${r.name}`,
      detail: `${friendlyNumber(r.portions)} portion${r.portions === 1 ? '' : 's'} in all${id.startsWith('template:') ? ', following the recipe' : ''}`,
    });
  }
  const cooking = [...totals.entries()].filter(([food]) => ACTIONS[food]).sort(([a], [b]) => ACTIONS[a].order - ACTIONS[b].order);
  for (const [food, g] of cooking) {
    const a = ACTIONS[food];
    const parts = [a.swell ? `${grams(g)} cooked (about ${grams(g / a.swell)} dry)` : grams(g)];
    if (a.note) parts.push(a.note);
    steps.push({ key: `cook:${food}`, title: a.title, detail: parts.join(', ') });
  }
  const chopped = [...totals.entries()].filter(([food]) => CHOP.has(food));
  if (chopped.length) {
    steps.push({
      key: 'chop',
      title: 'Chop the veg',
      detail: chopped.map(([food, g]) => `${nameOf(food)} ${grams(g)}`).join(' · '),
    });
  }
  if (boxes.length) {
    steps.push({
      key: 'pack',
      title: `Pack ${boxes.length} box${boxes.length === 1 ? '' : 'es'}`,
      detail: 'Cool the food quickly (rice within an hour), then share it out as below and get it in the fridge or freezer.',
    });
  }
  return { steps, boxes, madeOnTheDay };
}

/**
 * How to keep a recipe, by NHS advice: chilled leftovers within 2 days, cooked rice within 1 day; raw salad and
 * wraps don't freeze.
 */
export function storageAdvice(t: Pick<MealTemplate, 'id' | 'prep' | 'ingredients'>): string {
  if (t.prep === 'fresh') return 'Best made fresh, just before eating.';
  if (t.prep === 'parts') return 'Make the parts ahead (fridge, up to 2 days) and put it together on the day.';
  if (NO_FREEZER.has(t.id)) return 'Fridge: up to 2 days. Not for the freezer.';
  if (t.ingredients.some((i) => RICE.has(i.food))) {
    return 'Fridge: cool it quickly and eat within 1 day (it has cooked rice). Or freeze, and reheat until steaming hot.';
  }
  return 'Fridge: up to 2 days. Or freeze for up to 3 months, and reheat until steaming hot.';
}
