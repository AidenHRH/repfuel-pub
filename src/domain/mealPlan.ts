import type { PlanSlot } from './mealTemplates';
import type { Nutrients } from './types';

export const PLAN_SLOTS: PlanSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Something a plan can put on a day: one of RepFuel's simple meals, or one of the owner's saved meals. */
export type PlanCandidate = {
  kind: 'template' | 'recipe';
  id: string;
  name: string;
  slots: PlanSlot[];
  /** Per portion. Candidates with unknown calories or protein are left out of plans. */
  kcal: number;
  proteinG: number;
  /** Everything per portion (carbs, fat, fibre too), for prep totals. */
  nutrients?: Nutrients;
};

export type PlannedMeal = { slot: PlanSlot; kind: PlanCandidate['kind']; id: string; portions: number };

export type PlanTargets = { kcal: number; proteinG: number };

const MAIN_PORTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SNACK_PORTIONS = [0, 1, 2];
const SHORTLIST = 20;

/** A small, fast, seeded random number generator, so the same seed always gives the same plan. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const keyOf = (c: Pick<PlanCandidate, 'kind' | 'id'>) => `${c.kind}:${c.id}`;

/** How far a day is from its targets: calories either way; protein mostly when short, a little when far over. */
export function targetMiss(kcal: number, proteinG: number, targets: PlanTargets): number {
  return (
    Math.abs(kcal - targets.kcal) / targets.kcal +
    (1.5 * Math.max(0, targets.proteinG - proteinG)) / targets.proteinG +
    (0.4 * Math.max(0, proteinG - targets.proteinG * 1.25)) / targets.proteinG
  );
}

/**
 * Picks breakfast, lunch, dinner and maybe a snack for one day, with portions, to land near the targets.
 * `avoid` holds meals eaten the day before (never repeated back to back); `used` counts meals already
 * in the plan, so the week stays varied.
 */
export function planDay(
  candidates: PlanCandidate[],
  targets: PlanTargets,
  {
    random,
    avoid = new Set<string>(),
    used = new Map<string, number>(),
  }: { random: () => number; avoid?: Set<string>; used?: Map<string, number> },
): PlannedMeal[] {
  const options = (slot: PlanSlot) => {
    const all = candidates.filter((c) => c.slots.includes(slot));
    const fresh = all.filter((c) => !avoid.has(keyOf(c)));
    return fresh.length ? fresh : all;
  };
  const [breakfasts, lunches, dinners, snacks] = PLAN_SLOTS.map(options);
  if (!breakfasts.length || !lunches.length || !dinners.length) return [];

  const penalty = (c: PlanCandidate) => 0.12 * (used.get(keyOf(c)) ?? 0) + 0.1 * random();
  type Combo = { picks: PlanCandidate[]; snack: PlanCandidate | null; score: number };
  const combos: Combo[] = [];
  const seen = new Set<string>();
  for (const b of breakfasts)
    for (const l of lunches)
      for (const d of dinners) {
        // The same meal twice in a day isn't a plan anyone wants.
        if (new Set([keyOf(b), keyOf(l), keyOf(d)]).size < 3) continue;
        for (const s of [null, ...snacks]) {
          if (s && [b, l, d].some((m) => keyOf(m) === keyOf(s))) continue;
          const picks = [b, l, d];
          const kcal = picks.reduce((t, m) => t + m.kcal, 0) + (s?.kcal ?? 0);
          const protein = picks.reduce((t, m) => t + m.proteinG, 0) + (s?.proteinG ?? 0);
          const key = [...picks, s].map((m) => (m ? keyOf(m) : '-')).join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          combos.push({
            picks,
            snack: s,
            score: targetMiss(kcal, protein, targets) * 0.5 + [...picks, ...(s ? [s] : [])].reduce((t, m) => t + penalty(m), 0),
          });
        }
      }
  combos.sort((a, b) => a.score - b.score);

  let best: { meals: PlannedMeal[]; score: number } | null = null;
  for (const { picks, snack } of combos.slice(0, SHORTLIST)) {
    const variety = [...picks, ...(snack ? [snack] : [])].reduce((t, m) => t + 0.12 * (used.get(keyOf(m)) ?? 0), 0);
    for (const pb of MAIN_PORTIONS)
      for (const pl of MAIN_PORTIONS)
        for (const pd of MAIN_PORTIONS)
          for (const ps of snack ? SNACK_PORTIONS : [0]) {
            const portions = [pb, pl, pd];
            const kcal = picks.reduce((t, m, i) => t + m.kcal * portions[i], 0) + (snack ? snack.kcal * ps : 0);
            const protein = picks.reduce((t, m, i) => t + m.proteinG * portions[i], 0) + (snack ? snack.proteinG * ps : 0);
            // Prefer ordinary portions when the numbers are close.
            const oddness = portions.reduce((t, p) => t + Math.abs(p - 1), 0) * 0.02;
            const score = targetMiss(kcal, protein, targets) + oddness + variety;
            if (!best || score < best.score) {
              const meals: PlannedMeal[] = picks.map((m, i) => ({
                slot: PLAN_SLOTS[i],
                kind: m.kind,
                id: m.id,
                portions: portions[i],
              }));
              if (snack && ps > 0) meals.push({ slot: 'snack', kind: snack.kind, id: snack.id, portions: ps });
              best = { meals, score };
            }
          }
  }
  return best?.meals ?? [];
}

/** Plans `days` days in a row; `before` is the day just before the first, so it isn't repeated. */
export function planDays(
  candidates: PlanCandidate[],
  targets: PlanTargets,
  { days, seed, before = [] }: { days: number; seed: number; before?: PlannedMeal[] },
): PlannedMeal[][] {
  const random = seededRandom(seed);
  const used = new Map<string, number>();
  const out: PlannedMeal[][] = [];
  let avoid = new Set(before.map(keyOf));
  for (let i = 0; i < days; i++) {
    const day = planDay(candidates, targets, { random, avoid, used });
    for (const m of day) used.set(keyOf(m), (used.get(keyOf(m)) ?? 0) + 1);
    avoid = new Set(day.map(keyOf));
    out.push(day);
  }
  return out;
}

/** A day's planned calories and protein. */
export function planTotals(meals: PlannedMeal[], candidates: Map<string, PlanCandidate>): { kcal: number; proteinG: number } {
  let kcal = 0;
  let proteinG = 0;
  for (const m of meals) {
    const c = candidates.get(keyOf(m));
    if (!c) continue;
    kcal += c.kcal * m.portions;
    proteinG += c.proteinG * m.portions;
  }
  return { kcal, proteinG };
}

export const candidateKey = keyOf;
