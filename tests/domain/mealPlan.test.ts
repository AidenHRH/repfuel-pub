import { excludedBy, fitsDiet } from '@/domain/diet';
import { candidateKey, planDay, planDays, planTotals, seededRandom, type PlanCandidate } from '@/domain/mealPlan';
import { MEAL_TEMPLATES, templateNutrients, templateTags } from '@/domain/mealTemplates';

function templates(diet = excludedBy({ style: 'any', dairyFree: false, glutenFree: false })): PlanCandidate[] {
  return MEAL_TEMPLATES.filter((t) => fitsDiet(templateTags(t), diet)).map((t) => {
    const n = templateNutrients(t);
    return { kind: 'template', id: t.id, name: t.name, slots: [t.slot], kcal: n.kcal!, proteinG: n.proteinG! };
  });
}
const byKey = (c: PlanCandidate[]) => new Map(c.map((x) => [candidateKey(x), x]));

test('a day lands near the calorie target and reaches most of the protein', () => {
  const c = templates();
  for (const targets of [
    { kcal: 2500, proteinG: 145 },
    { kcal: 1900, proteinG: 120 },
  ]) {
    const day = planDay(c, targets, { random: seededRandom(1) });
    expect(day.map((m) => m.slot).slice(0, 3)).toEqual(['breakfast', 'lunch', 'dinner']);
    const t = planTotals(day, byKey(c));
    expect(Math.abs(t.kcal - targets.kcal) / targets.kcal).toBeLessThan(0.08);
    expect(t.proteinG).toBeGreaterThan(targets.proteinG * 0.8);
  }
});

test('a week has no meal two days running, and the same seed gives the same week', () => {
  const c = templates();
  const week = planDays(c, { kcal: 2500, proteinG: 145 }, { days: 7, seed: 42 });
  expect(week).toHaveLength(7);
  for (let i = 1; i < 7; i++) {
    const yesterday = new Set(week[i - 1].map(candidateKey));
    for (const m of week[i]) expect(yesterday.has(candidateKey(m))).toBe(false);
  }
  expect(planDays(c, { kcal: 2500, proteinG: 145 }, { days: 7, seed: 42 })).toEqual(week);
  expect(planDays(c, { kcal: 2500, proteinG: 145 }, { days: 7, seed: 43 })).not.toEqual(week);
});

test('a vegan week only uses vegan meals', () => {
  const c = templates(excludedBy({ style: 'vegan', dairyFree: false, glutenFree: true }));
  const week = planDays(c, { kcal: 2200, proteinG: 120 }, { days: 7, seed: 5 });
  const allowed = new Set(c.map(candidateKey));
  for (const day of week) {
    expect(day.length).toBeGreaterThanOrEqual(3);
    for (const m of day) expect(allowed.has(candidateKey(m))).toBe(true);
  }
});

test('nothing to choose from for a meal gives an empty day rather than a broken one', () => {
  const c = templates().filter((t) => !t.slots.includes('dinner'));
  expect(planDay(c, { kcal: 2000, proteinG: 120 }, { random: seededRandom(1) })).toEqual([]);
});

test('protein lands near the target rather than far over it', () => {
  const c = templates();
  const m = byKey(c);
  for (const day of planDays(c, { kcal: 2500, proteinG: 145 }, { days: 7, seed: 9 })) {
    expect(planTotals(day, m).proteinG).toBeLessThan(145 * 1.4);
  }
});
