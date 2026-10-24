import { getCommonFood } from '@/domain/commonFoods';
import { localDayKey } from '@/domain/dates';
import { CONTAINS, DEFAULT_DIET, excludedBy, fitsDiet, type DietPrefs } from '@/domain/diet';
import {
  candidateKey,
  planDay,
  planDays,
  PLAN_SLOTS,
  seededRandom,
  type PlanCandidate,
  type PlannedMeal,
} from '@/domain/mealPlan';
import { prepSession, type PrepMeal, type PrepSession } from '@/domain/mealPrep';
import {
  DEFAULT_PREP,
  MAX_PREP_DAYS,
  PREP_SLOTS,
  prepTotals,
  shuffleSlot,
  sizeFor,
  suggestPrep,
  type PrepChoice,
  type PrepSettings,
  type PrepSlot,
} from '@/domain/prepPlan';
import { getMealTemplate, MEAL_TEMPLATES, templateNutrients, templateTags, type PlanSlot } from '@/domain/mealTemplates';
import { buildShoppingList, type ShoppingGroup, type ShoppingLine } from '@/domain/shoppingList';
import type { FoodLogEntry, MealCategory, Nutrients } from '@/domain/types';

import type { Db } from '../Db';
import { nowIso } from '../ids';

import { logLoggable } from './foodLogRepository';
import { getFood, savePresetFood } from './foodRepository';
import { createRecipe, deleteRecipe, getRecipe, listRecipes, recipeNutrients } from './recipeRepository';
import { getSetting, setSetting } from './settingsRepository';
import { getCurrentTargets } from './targetsRepository';

export const PLAN_DAYS = 7;
const PREFS_KEY = 'dietPrefs';

export async function getDietPrefs(db: Db): Promise<DietPrefs> {
  return { ...DEFAULT_DIET, ...(await getSetting<Partial<DietPrefs>>(db, PREFS_KEY, {})) };
}

export async function setDietPrefs(db: Db, prefs: DietPrefs): Promise<void> {
  await setSetting(db, PREFS_KEY, prefs);
}

/** The days a plan covers from `from`, as YYYY-MM-DD. */
export function planDayKeys(from: Date, days = PLAN_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return localDayKey(d);
  });
}

function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDayKey(new Date(y, m - 1, d + by));
}

/** The meals a plan may use: RepFuel's simple meals that suit the diet, and the owner's own saved meals. */
export async function planCandidates(db: Db, prefs: DietPrefs): Promise<PlanCandidate[]> {
  const excluded = excludedBy(prefs);
  const out: PlanCandidate[] = MEAL_TEMPLATES.filter((t) => fitsDiet(templateTags(t), excluded)).map((t) => {
    const n = templateNutrients(t);
    return { kind: 'template', id: t.id, name: t.name, slots: [t.slot], kcal: n.kcal!, proteinG: n.proteinG!, nutrients: n };
  });
  if (!prefs.useMyMeals) return out;

  // Which meal each saved meal is usually eaten at.
  const usual = await db.getAll<{ recipe_id: string; meal_category: MealCategory; n: number }>(
    `SELECT recipe_id, meal_category, count(*) AS n FROM food_log_entry WHERE recipe_id IS NOT NULL
     GROUP BY recipe_id, meal_category ORDER BY n DESC`,
  );
  // Only what RepFuel can tell from the built-in foods; the owner's own foods are taken as suiting them.
  const tags = await db.getAll<{ recipe_id: string; preset_id: string }>(
    `SELECT i.recipe_id, f.preset_id FROM recipe_ingredient i JOIN food_product f ON f.id = i.food_product_id WHERE f.preset_id IS NOT NULL`,
  );
  // Logging a planned dish saves it under My meals with the same name: that's the same dish, not another to shuffle to.
  const nameKey = (name: string) => name.trim().toLowerCase();
  const templateNames = new Set(out.map((c) => nameKey(c.name)));
  for (const recipe of await listRecipes(db, {})) {
    if (templateNames.has(nameKey(recipe.name))) continue;
    const contains = tags.filter((t) => t.recipe_id === recipe.id).flatMap((t) => CONTAINS[t.preset_id] ?? []);
    if (!fitsDiet(contains, excluded)) continue;
    const { nutrients } = await recipeNutrients(db, recipe.id);
    if (nutrients.kcal === null || nutrients.proteinG === null || nutrients.kcal <= 0) continue;
    // Plans have breakfast, lunch, dinner and a snack; a meal logged as a drink (a shake) only counts at those.
    const slots = [...new Set(usual.filter((u) => u.recipe_id === recipe.id).map((u) => u.meal_category))].filter(
      (c): c is PlanSlot => (PLAN_SLOTS as string[]).includes(c),
    );
    out.push({
      kind: 'recipe',
      id: recipe.id,
      name: recipe.name,
      slots: slots.length ? slots : nutrients.kcal < 250 ? ['snack'] : ['lunch', 'dinner'],
      kcal: nutrients.kcal,
      proteinG: nutrients.proteinG,
      nutrients,
    });
  }
  return out;
}

type PlanRow = {
  local_day: string;
  slot: PlanSlot;
  item_kind: 'template' | 'recipe';
  item_id: string;
  portions: number;
  logged: number;
};

export type PlanDayView = {
  day: string;
  meals: (PlannedMeal & { name: string; kcal: number | null; proteinG: number | null; logged: boolean })[];
};

/** The saved plan for these days, with names and numbers for each meal. */
export async function getPlan(db: Db, days: string[]): Promise<PlanDayView[]> {
  if (!days.length) return [];
  const rows = await db.getAll<PlanRow>(
    `SELECT p.local_day, p.slot, p.item_kind, p.item_id, p.portions, (e.id IS NOT NULL) AS logged
     FROM meal_plan p LEFT JOIN food_log_entry e ON e.id = p.logged_entry_id
     WHERE p.local_day BETWEEN ? AND ?`,
    [days[0], days[days.length - 1]],
  );
  const recipeNames = new Map<string, { name: string; kcal: number | null; proteinG: number | null }>();
  for (const id of new Set(rows.filter((r) => r.item_kind === 'recipe').map((r) => r.item_id))) {
    const recipe = await getRecipe(db, id);
    const { nutrients } = await recipeNutrients(db, id);
    recipeNames.set(id, { name: recipe?.name ?? 'Meal', kcal: nutrients.kcal, proteinG: nutrients.proteinG });
  }
  return days.map((day) => ({
    day,
    meals: rows
      .filter((r) => r.local_day === day)
      .sort((a, b) => PLAN_SLOTS.indexOf(a.slot) - PLAN_SLOTS.indexOf(b.slot))
      .flatMap((r) => {
        let info: { name: string; kcal: number | null; proteinG: number | null } | undefined;
        if (r.item_kind === 'template') {
          const t = getMealTemplate(r.item_id);
          if (t) {
            const n = templateNutrients(t);
            info = { name: t.name, kcal: n.kcal, proteinG: n.proteinG };
          }
        } else info = recipeNames.get(r.item_id);
        if (!info) return [];
        return [
          {
            slot: r.slot,
            kind: r.item_kind,
            id: r.item_id,
            portions: r.portions,
            name: info.name,
            kcal: info.kcal === null ? null : info.kcal * r.portions,
            proteinG: info.proteinG === null ? null : info.proteinG * r.portions,
            logged: r.logged === 1,
          },
        ];
      }),
  }));
}

async function saveDay(db: Db, day: string, meals: PlannedMeal[]) {
  await db.run('DELETE FROM meal_plan WHERE local_day = ?', [day]);
  for (const m of meals) {
    await db.run('INSERT INTO meal_plan (local_day, slot, item_kind, item_id, portions) VALUES (?, ?, ?, ?, ?)', [
      day,
      m.slot,
      m.kind,
      m.id,
      m.portions,
    ]);
  }
}

async function plannedOn(db: Db, day: string): Promise<PlannedMeal[]> {
  const rows = await db.getAll<PlanRow>('SELECT slot, item_kind, item_id, portions FROM meal_plan WHERE local_day = ?', [day]);
  return rows.map((r) => ({ slot: r.slot, kind: r.item_kind, id: r.item_id, portions: r.portions }));
}

async function planInputs(db: Db) {
  const prefs = await getDietPrefs(db);
  // Today's targets, even for later days: a plan is for the targets the owner has now.
  const targets = await getCurrentTargets(db);
  const candidates = await planCandidates(db, prefs);
  return { candidates, targets: { kcal: targets.caloriesKcal, proteinG: targets.proteinGrams } };
}

/** Plans the week from `from` (replacing any plan for those days) and clears the shopping list's ticks. */
export async function makePlan(
  db: Db,
  { from = new Date(), seed = Date.now() }: { from?: Date; seed?: number } = {},
): Promise<void> {
  const days = planDayKeys(from);
  const { candidates, targets } = await planInputs(db);
  const week = planDays(candidates, targets, { days: days.length, seed, before: await plannedOn(db, shiftDay(days[0], -1)) });
  await db.transaction(async () => {
    for (const [i, day] of days.entries()) await saveDay(db, day, week[i]);
    await db.run('DELETE FROM shopping_tick');
  });
}

/** Re-plans one day, steering clear of the meals planned the day before and after. */
export async function shuffleDay(db: Db, day: string, seed = Date.now()): Promise<void> {
  const { candidates, targets } = await planInputs(db);
  const current = await plannedOn(db, day);
  const neighbours = [...(await plannedOn(db, shiftDay(day, -1))), ...(await plannedOn(db, shiftDay(day, 1)))];
  // Today's own meals are avoided too, so Shuffle always changes something when it can.
  const avoid = new Set([...neighbours, ...current].map(candidateKey));
  const meals = planDay(candidates, targets, { random: seededRandom(seed), avoid });
  await saveDay(db, day, meals);
}

export async function hasPlan(db: Db, days: string[]): Promise<boolean> {
  const row = await db.getFirst<{ n: number }>('SELECT count(*) AS n FROM meal_plan WHERE local_day BETWEEN ? AND ?', [
    days[0],
    days[days.length - 1],
  ]);
  return (row?.n ?? 0) > 0;
}

/** Logs a planned meal now. A simple meal is logged like a built-in-the-moment meal, so it doesn't fill My meals. */
export async function logPlannedMeal(db: Db, day: string, slot: PlanSlot, at: Date = new Date()): Promise<FoodLogEntry> {
  const planned = (await plannedOn(db, day)).find((m) => m.slot === slot);
  if (!planned) throw new Error('Nothing planned');
  let entry: FoodLogEntry;
  if (planned.kind === 'recipe') {
    entry = await logLoggable(db, { kind: 'recipe', id: planned.id }, planned.portions, at, slot);
  } else {
    const t = getMealTemplate(planned.id);
    if (!t) throw new Error('Unknown meal');
    const ingredients = [];
    for (const { food, grams } of t.ingredients) {
      const saved = await savePresetFood(db, getCommonFood(food)!);
      ingredients.push({
        kind: 'food' as const,
        foodId: saved.id,
        amount: grams,
        unit: saved.basis === 'per_100ml' ? ('ml' as const) : ('g' as const),
      });
    }
    const recipe = await createRecipe(db, { name: t.name, portionsMade: 1, ingredients });
    entry = await logLoggable(db, { kind: 'recipe', id: recipe.id }, planned.portions, at, slot);
    await deleteRecipe(db, recipe.id);
  }
  await db.run('UPDATE meal_plan SET logged_entry_id = ? WHERE local_day = ? AND slot = ?', [entry.id, day, slot]);
  return entry;
}

async function recipeLines(db: Db, recipeId: string, portions: number, depth = 0): Promise<ShoppingLine[]> {
  const recipe = await getRecipe(db, recipeId);
  if (!recipe || depth > 5) return [];
  const share = portions / recipe.portionsMade;
  const lines: ShoppingLine[] = [];
  for (const ing of recipe.ingredients) {
    if (ing.kind === 'recipe') {
      lines.push(...(await recipeLines(db, ing.subRecipeId, ing.portions * share, depth + 1)));
      continue;
    }
    const food = await getFood(db, ing.foodId);
    if (!food) continue;
    const preset = food.presetId ? getCommonFood(food.presetId) : null;
    // A serving of a common food is its first measure, so it adds up with the same food in grams.
    const unit = ing.unit === 'serving' && preset ? (preset.basis === 'per_100ml' ? 'ml' : 'g') : ing.unit;
    const amount = ing.unit === 'serving' && preset ? ing.amount * preset.measures[0].grams : ing.amount;
    lines.push(
      preset
        ? {
            key: `preset:${preset.id}`,
            name: preset.name,
            group: preset.group,
            amount: amount * share,
            unit,
            measures: preset.measures,
          }
        : {
            key: `food:${food.id}`,
            name: food.brand ? `${food.name} (${food.brand})` : food.name,
            group: 'Other',
            amount: amount * share,
            unit,
          },
    );
  }
  return lines;
}

/** Everything the plan needs from `from` onwards (meals already logged are left off). */
export async function planShoppingList(db: Db, days: string[]): Promise<ShoppingGroup[]> {
  const lines: ShoppingLine[] = [];
  for (const { meals } of await getPlan(db, days)) {
    for (const m of meals) {
      if (m.logged) continue;
      if (m.kind === 'recipe') {
        lines.push(...(await recipeLines(db, m.id, m.portions)));
        continue;
      }
      for (const { food, grams } of getMealTemplate(m.id)?.ingredients ?? []) {
        const f = getCommonFood(food)!;
        lines.push({
          key: `preset:${f.id}`,
          name: f.name,
          group: f.group,
          amount: grams * m.portions,
          unit: f.basis === 'per_100ml' ? 'ml' : 'g',
          measures: f.measures,
        });
      }
    }
  }
  return buildShoppingList(lines);
}

export async function shoppingTicks(db: Db): Promise<Set<string>> {
  return new Set((await db.getAll<{ item_key: string }>('SELECT item_key FROM shopping_tick')).map((r) => r.item_key));
}

export async function setShoppingTick(db: Db, key: string, ticked: boolean): Promise<void> {
  if (ticked) await db.run('INSERT OR REPLACE INTO shopping_tick (item_key, ticked_at) VALUES (?, ?)', [key, nowIso()]);
  else await db.run('DELETE FROM shopping_tick WHERE item_key = ?', [key]);
}

/**
 * A cooking session for the planned meals on `days` (not yet logged), prepped on `prepDay`.
 * Your own meals are one "make" step each; RepFuel's simple meals are broken into what to cook.
 */
export async function prepFor(db: Db, days: string[], prepDay: string): Promise<PrepSession> {
  const toDate = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const start = toDate(prepDay).getTime();
  const meals: PrepMeal[] = [];
  for (const { day, meals: planned } of await getPlan(db, days)) {
    const date = toDate(day);
    const daysAhead = Math.round((date.getTime() - start) / 86_400_000);
    const dayLabel = date.toLocaleDateString('en-GB', { weekday: 'short' });
    for (const m of planned) {
      if (m.logged) continue;
      const template = m.kind === 'template' ? getMealTemplate(m.id) : null;
      if (m.kind === 'template' && !template) continue;
      meals.push({
        day,
        daysAhead,
        dayLabel,
        slot: m.slot,
        portions: m.portions,
        meal: template ? { kind: 'template', template } : { kind: 'recipe', id: m.id, name: m.name },
      });
    }
  }
  return prepSession(meals);
}

const PREP_TICKS_KEY = 'prepTicks';

/** Ticked prep steps and boxes for one session (`session` names the days it covers). */
export async function prepTicks(db: Db, session: string): Promise<Set<string>> {
  const saved = await getSetting<{ session: string; done: string[] } | null>(db, PREP_TICKS_KEY, null);
  return new Set(saved?.session === session ? saved.done : []);
}

export async function setPrepTicks(db: Db, session: string, done: Set<string>): Promise<void> {
  await setSetting(db, PREP_TICKS_KEY, { session, done: [...done] });
}

// ---------------------------------------------------------------------------------------------------------------
// Prep plan: one dish per meal for the prep days, stored as a row per day and meal so the shopping list, meal prep
// and logging work as before.

export async function getPrepSettings(db: Db): Promise<PrepSettings> {
  const saved = await getSetting<Partial<PrepSettings>>(db, 'prep', {});
  const days = Math.min(MAX_PREP_DAYS, Math.max(1, Math.round(saved.days ?? DEFAULT_PREP.days)));
  const slots = (saved.slots ?? DEFAULT_PREP.slots).filter((s): s is PrepSlot => PREP_SLOTS.includes(s));
  return { days, start: saved.start === 'today' ? 'today' : 'tomorrow', slots };
}

export async function setPrepSettings(db: Db, settings: PrepSettings): Promise<void> {
  await setSetting(db, 'prep', settings);
}

/** The days a prep covers, from today or tomorrow. */
export function prepDayKeys(settings: PrepSettings, now: Date = new Date()): string[] {
  const from = new Date(now);
  if (settings.start === 'tomorrow') from.setDate(from.getDate() + 1);
  return planDayKeys(from, settings.days);
}

export type PrepMealView = PrepChoice & { name: string; per: Nutrients; logged: boolean };
export type PrepView = {
  days: string[];
  /** One dish per meal switched on, the same every day; null when there's no such prep for these days. */
  meals: PrepMealView[] | null;
  /** A plan from before prep plans (different meals each day), shown day by day. */
  earlier: PlanDayView[] | null;
  totals: ReturnType<typeof prepTotals> | null;
  targets: { kcal: number; proteinG: number };
};

async function dishNutrients(db: Db, kind: 'template' | 'recipe', id: string): Promise<{ name: string; per: Nutrients } | null> {
  if (kind === 'template') {
    const t = getMealTemplate(id);
    return t ? { name: t.name, per: templateNutrients(t) } : null;
  }
  const recipe = await getRecipe(db, id);
  if (!recipe) return null;
  return { name: recipe.name, per: (await recipeNutrients(db, id)).nutrients };
}

export async function getPrep(db: Db, settings: PrepSettings, now: Date = new Date()): Promise<PrepView> {
  const days = prepDayKeys(settings, now);
  const t = await getCurrentTargets(db);
  const targets = { kcal: t.caloriesKcal, proteinG: t.proteinGrams };
  const plan = await getPlan(db, days);
  const empty: PrepView = { days, meals: null, earlier: null, totals: null, targets };
  if (!plan.some((d) => d.meals.length)) return empty;

  const meals: PrepMealView[] = [];
  let uniform = true;
  for (const slot of settings.slots) {
    const each = plan.map((d) => d.meals.find((m) => m.slot === slot));
    const first = each[0];
    if (!first || each.some((m) => !m || m.kind !== first.kind || m.id !== first.id || m.portions !== first.portions)) {
      uniform = false;
      break;
    }
    const dish = await dishNutrients(db, first.kind, first.id);
    if (!dish) continue;
    meals.push({
      slot,
      kind: first.kind,
      id: first.id,
      portions: first.portions,
      name: dish.name,
      per: dish.per,
      logged: first.logged && days[0] === localDayKey(now),
    });
  }
  if (!uniform || !meals.length) return { ...empty, earlier: plan };
  const candidates = new Map(
    meals.map((m) => [
      candidateKey(m),
      {
        kind: m.kind,
        id: m.id,
        name: m.name,
        slots: [m.slot],
        kcal: m.per.kcal ?? 0,
        proteinG: m.per.proteinG ?? 0,
        nutrients: m.per,
      } as PlanCandidate,
    ]),
  );
  return { days, meals, earlier: null, totals: prepTotals(meals, candidates, days.length), targets };
}

async function writePrep(db: Db, days: string[], choices: PrepChoice[], replaceAll: boolean) {
  await db.transaction(async () => {
    for (const day of days) {
      if (replaceAll) await db.run('DELETE FROM meal_plan WHERE local_day = ?', [day]);
      for (const c of choices) {
        if (!replaceAll) await db.run('DELETE FROM meal_plan WHERE local_day = ? AND slot = ?', [day, c.slot]);
        await db.run('INSERT INTO meal_plan (local_day, slot, item_kind, item_id, portions) VALUES (?, ?, ?, ?, ?)', [
          day,
          c.slot,
          c.kind,
          c.id,
          c.portions,
        ]);
      }
    }
    await db.run('DELETE FROM shopping_tick');
  });
}

/** Suggests a dish for each meal switched on and plans it for every prep day (replacing what was planned). */
export async function makePrep(db: Db, settings: PrepSettings, { now = new Date(), seed = Date.now() } = {}): Promise<void> {
  const { candidates, targets } = await planInputs(db);
  const choices = suggestPrep(candidates, settings.slots, targets, seededRandom(seed));
  await writePrep(db, prepDayKeys(settings, now), choices, true);
}

/** Another dish for one meal across the prep days, sized around the other meals. */
export async function shufflePrepSlot(
  db: Db,
  settings: PrepSettings,
  slot: PrepSlot,
  { now = new Date(), seed = Date.now() } = {},
) {
  const view = await getPrep(db, settings, now);
  if (!view.meals) return;
  const { candidates, targets } = await planInputs(db);
  const next = shuffleSlot(candidates, view.meals, slot, targets, seededRandom(seed));
  const changed = next.find((c) => c.slot === slot);
  if (changed) await writePrep(db, view.days, [changed], false);
}

/** Puts a chosen dish (from the recipe book or the owner's meals) on one meal for every prep day. */
export async function choosePrepDish(
  db: Db,
  settings: PrepSettings,
  slot: PrepSlot,
  dish: { kind: 'template' | 'recipe'; id: string },
  now: Date = new Date(),
): Promise<void> {
  const view = await getPrep(db, settings, now);
  const { candidates, targets } = await planInputs(db);
  const others = (view.meals ?? []).filter((m) => m.slot !== slot);
  const info = await dishNutrients(db, dish.kind, dish.id);
  if (!info) throw new Error('That meal isn’t available');
  const candidate: PlanCandidate = {
    ...dish,
    name: info.name,
    slots: [slot],
    kcal: info.per.kcal ?? 0,
    proteinG: info.per.proteinG ?? 0,
    nutrients: info.per,
  };
  const portions = sizeFor([...candidates, candidate], others, candidate, slot, targets);
  await writePrep(db, view.days, [{ slot, ...dish, portions }], !view.meals);
}
