import type { MealDbIngredient } from '@/domain/mealdbMatch';

const BASE = 'https://www.themealdb.com/api/json/v1/1';

/** A meal in a list of results. */
export type MealDbSummary = { id: string; name: string; thumb: string | null };

/** A whole TheMealDB recipe, with its instructions split into steps. */
export type MealDbMeal = MealDbSummary & {
  category: string | null;
  area: string | null;
  ingredients: MealDbIngredient[];
  steps: string[];
};

export type MealDbFailure = { status: 'error' };
export type MealDbList = { status: 'ok'; meals: MealDbSummary[] } | MealDbFailure;
export type MealDbLookup = { status: 'ok'; meal: MealDbMeal } | { status: 'not_found' } | MealDbFailure;
export type MealDbCategories = { status: 'ok'; categories: string[] } | MealDbFailure;

export interface MealDb {
  searchMeals(query: string): Promise<MealDbList>;
  mealsIn(category: string): Promise<MealDbList>;
  getMeal(id: string): Promise<MealDbLookup>;
  categories(): Promise<MealDbCategories>;
}

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => typeof v === 'object' && v !== null;
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function toSummary(row: Row): MealDbSummary | null {
  const id = text(row.idMeal);
  const name = text(row.strMeal);
  return id && name ? { id, name, thumb: text(row.strMealThumb) } : null;
}

/** "STEP 1\r\nHeat the oil…\r\n\r\n2. Add…" → ["Heat the oil…", "Add…"]. */
export function splitSteps(instructions: string): string[] {
  return instructions
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim())
    .filter((line) => line.length > 0);
}

export function parseMeal(row: Row): MealDbMeal | null {
  const summary = toSummary(row);
  if (!summary) return null;
  const ingredients: MealDbIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = text(row[`strIngredient${i}`]);
    if (name) ingredients.push({ name, measure: text(row[`strMeasure${i}`]) ?? '' });
  }
  return {
    ...summary,
    category: text(row.strCategory),
    area: text(row.strArea),
    ingredients,
    steps: splitSteps(text(row.strInstructions) ?? ''),
  };
}

/** TheMealDB over the network. Never throws: failures come back as `{ status: 'error' }`. */
export function createMealDb(fetchImpl: typeof fetch = (input, init) => fetch(input, init), timeoutMs = 8000): MealDb {
  async function get(path: string): Promise<Row | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${BASE}/${path}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      return isRow(body) ? body : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function list(path: string): Promise<MealDbList> {
    const body = await get(path);
    if (!body) return { status: 'error' };
    const rows = Array.isArray(body.meals) ? body.meals.filter(isRow) : [];
    return { status: 'ok', meals: rows.flatMap((r) => toSummary(r) ?? []) };
  }

  return {
    searchMeals: (query) => list(`search.php?s=${encodeURIComponent(query.trim())}`),
    mealsIn: (category) => list(`filter.php?c=${encodeURIComponent(category)}`),
    async getMeal(id) {
      const body = await get(`lookup.php?i=${encodeURIComponent(id)}`);
      if (!body) return { status: 'error' };
      const row = Array.isArray(body.meals) ? body.meals.find(isRow) : undefined;
      const meal = row ? parseMeal(row) : null;
      return meal ? { status: 'ok', meal } : { status: 'not_found' };
    },
    async categories() {
      const body = await get('list.php?c=list');
      if (!body) return { status: 'error' };
      const rows = Array.isArray(body.meals) ? body.meals.filter(isRow) : [];
      return { status: 'ok', categories: rows.flatMap((r) => text(r.strCategory) ?? []) };
    },
  };
}

let instance: MealDb | null = null;

/** The shared TheMealDB client. */
export function getMealDb(): MealDb {
  instance ??= createMealDb();
  return instance;
}
