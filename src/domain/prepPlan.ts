import { candidateKey, targetMiss, type PlanCandidate, type PlannedMeal, type PlanTargets } from './mealPlan';
import type { Nutrients } from './types';

/** The meals a prep plan covers. Snacks aren't prepped. */
export type PrepSlot = 'breakfast' | 'lunch' | 'dinner';
export const PREP_SLOTS: PrepSlot[] = ['breakfast', 'lunch', 'dinner'];

/** How many days to prep for, from today or tomorrow, and which meals. */
export type PrepSettings = { days: number; start: 'today' | 'tomorrow'; slots: PrepSlot[] };
export const DEFAULT_PREP: PrepSettings = { days: 3, start: 'tomorrow', slots: [...PREP_SLOTS] };
export const MAX_PREP_DAYS = 7;

/** One dish for a meal, the same every prep day. */
export type PrepChoice = PlannedMeal & { slot: PrepSlot };

/** Each meal's share of a day's targets, so prepping just lunch and dinner aims at their part of the day. */
const SHARE: Record<PrepSlot, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.4 };
const PORTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SHORTLIST = 6;

function scaled(targets: PlanTargets, slots: PrepSlot[]): PlanTargets {
  const share = slots.reduce((t, s) => t + SHARE[s], 0);
  return { kcal: targets.kcal * share, proteinG: targets.proteinG * share };
}

const oddness = (p: number) => Math.abs(p - 1) * 0.02;

/** The candidates for a meal that fit it on their own best (with a little randomness so suggestions vary). */
function shortlist(candidates: PlanCandidate[], slot: PrepSlot, targets: PlanTargets, random: () => number, avoid: Set<string>) {
  const own = { kcal: targets.kcal * SHARE[slot], proteinG: targets.proteinG * SHARE[slot] };
  const all = candidates.filter((c) => c.slots.includes(slot));
  const fresh = all.filter((c) => !avoid.has(candidateKey(c)));
  return (fresh.length ? fresh : all)
    .map((c) => ({ c, score: Math.min(...PORTIONS.map((p) => targetMiss(c.kcal * p, c.proteinG * p, own))) + 0.6 * random() }))
    .sort((a, b) => a.score - b.score)
    .slice(0, SHORTLIST)
    .map((x) => x.c);
}

/** Suggests one dish per meal, with portions, so the meals switched on land near their share of the day's targets. */
export function suggestPrep(
  candidates: PlanCandidate[],
  slots: PrepSlot[],
  targets: PlanTargets,
  random: () => number,
): PrepChoice[] {
  const ordered = PREP_SLOTS.filter((s) => slots.includes(s));
  const lists = ordered.map((s) => shortlist(candidates, s, targets, random, new Set()));
  if (lists.some((l) => !l.length)) return [];
  const goal = scaled(targets, ordered);
  let best: { choices: PrepChoice[]; score: number } | null = null;

  const walk = (i: number, picked: { c: PlanCandidate; p: number }[]) => {
    if (i === ordered.length) {
      const kcal = picked.reduce((t, x) => t + x.c.kcal * x.p, 0);
      const protein = picked.reduce((t, x) => t + x.c.proteinG * x.p, 0);
      const score = targetMiss(kcal, protein, goal) + picked.reduce((t, x) => t + oddness(x.p), 0);
      if (!best || score < best.score) {
        best = {
          score,
          choices: picked.map((x, j) => ({ slot: ordered[j], kind: x.c.kind, id: x.c.id, portions: x.p })),
        };
      }
      return;
    }
    for (const c of lists[i]) {
      if (picked.some((x) => candidateKey(x.c) === candidateKey(c))) continue;
      for (const p of PORTIONS) walk(i + 1, [...picked, { c, p }]);
    }
  };
  walk(0, []);
  return best ? (best as { choices: PrepChoice[] }).choices : [];
}

/** Another dish for one meal (never the same one when there's a choice), sized around the others. */
export function shuffleSlot(
  candidates: PlanCandidate[],
  choices: PrepChoice[],
  slot: PrepSlot,
  targets: PlanTargets,
  random: () => number,
): PrepChoice[] {
  const current = choices.find((c) => c.slot === slot);
  const others = choices.filter((c) => c.slot !== slot);
  const avoid = new Set([...choices].map(candidateKey));
  const options = shortlist(candidates, slot, targets, random, avoid).filter(
    (c) => !current || candidateKey(c) !== candidateKey(current),
  );
  if (!options.length) return choices;
  const pick = options[0];
  return choices.map((c) =>
    c.slot === slot ? { slot, kind: pick.kind, id: pick.id, portions: sizeFor(candidates, others, pick, slot, targets) } : c,
  );
}

/** The portions of `dish` that bring the day (with the other meals as they are) nearest its targets. */
export function sizeFor(
  candidates: PlanCandidate[],
  others: PrepChoice[],
  dish: PlanCandidate,
  slot: PrepSlot,
  targets: PlanTargets,
): number {
  const byKey = new Map(candidates.map((c) => [candidateKey(c), c]));
  const goal = scaled(targets, [...others.map((o) => o.slot), slot]);
  const base = others.reduce(
    (t, o) => {
      const c = byKey.get(candidateKey(o));
      return c ? { kcal: t.kcal + c.kcal * o.portions, proteinG: t.proteinG + c.proteinG * o.portions } : t;
    },
    { kcal: 0, proteinG: 0 },
  );
  return PORTIONS.reduce((best, p) => {
    const score = (q: number) => targetMiss(base.kcal + dish.kcal * q, base.proteinG + dish.proteinG * q, goal) + oddness(q);
    return score(p) < score(best) ? p : best;
  }, 1);
}

const ZERO: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 };
const KEYS = Object.keys(ZERO) as (keyof Nutrients)[];

function add(a: Nutrients, b: Nutrients, times = 1): Nutrients {
  const out = { ...a };
  for (const k of KEYS) out[k] = a[k] === null || b[k] === null ? null : a[k]! + b[k]! * times;
  return out;
}

/** Each meal for its portions, one day of them, and the whole prep (`days` days). Unknowns stay unknown. */
export function prepTotals(
  choices: PlannedMeal[],
  candidates: Map<string, PlanCandidate>,
  days: number,
): { perMeal: Partial<Record<PrepSlot, Nutrients>>; perDay: Nutrients; whole: Nutrients } {
  const perMeal: Partial<Record<PrepSlot, Nutrients>> = {};
  let perDay = { ...ZERO };
  for (const m of choices) {
    const c = candidates.get(candidateKey(m));
    if (!c) continue;
    const per: Nutrients = c.nutrients ?? { kcal: c.kcal, proteinG: c.proteinG, carbsG: null, fatG: null, fibreG: null };
    const meal = add(ZERO, per, m.portions);
    perMeal[m.slot as PrepSlot] = meal;
    perDay = add(perDay, meal);
  }
  return { perMeal, perDay, whole: add(ZERO, perDay, days) };
}
