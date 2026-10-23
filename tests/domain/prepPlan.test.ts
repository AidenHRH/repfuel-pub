import type { PlanCandidate } from '@/domain/mealPlan';
import { seededRandom } from '@/domain/mealPlan';
import { DEFAULT_PREP, prepTotals, shuffleSlot, suggestPrep } from '@/domain/prepPlan';

const n = (kcal: number, proteinG: number) => ({ kcal, proteinG, carbsG: kcal / 8, fatG: kcal / 40, fibreG: 5 });
const c = (id: string, slot: 'breakfast' | 'lunch' | 'dinner', kcal: number, proteinG: number): PlanCandidate => ({
  kind: 'template',
  id,
  name: id,
  slots: [slot],
  kcal,
  proteinG,
  nutrients: n(kcal, proteinG),
});
const CANDIDATES = [
  c('oats', 'breakfast', 450, 35),
  c('eggs', 'breakfast', 380, 25),
  c('muffins', 'breakfast', 300, 22),
  c('chicken-rice', 'lunch', 600, 50),
  c('pesto-pasta', 'lunch', 650, 42),
  c('fajita', 'lunch', 580, 45),
  c('chilli', 'dinner', 650, 48),
  c('salmon', 'dinner', 700, 40),
  c('bolognese', 'dinner', 620, 45),
];
const TARGETS = { kcal: 2400, proteinG: 160 };

test('one dish per meal switched on, sized to land near the day’s targets', () => {
  const choices = suggestPrep(CANDIDATES, DEFAULT_PREP.slots, TARGETS, seededRandom(1));
  expect(choices.map((x) => x.slot)).toEqual(['breakfast', 'lunch', 'dinner']);
  const day = prepTotals(choices, new Map(CANDIDATES.map((x) => [`template:${x.id}`, x])), 1).perDay;
  expect(Math.abs(day.kcal! - TARGETS.kcal) / TARGETS.kcal).toBeLessThan(0.12);
});

test('only the meals switched on, aiming at their share of the day', () => {
  const choices = suggestPrep(CANDIDATES, ['lunch', 'dinner'], TARGETS, seededRandom(2));
  expect(choices.map((x) => x.slot)).toEqual(['lunch', 'dinner']);
  const day = prepTotals(choices, new Map(CANDIDATES.map((x) => [`template:${x.id}`, x])), 1).perDay;
  // Lunch and dinner are 75% of the day.
  expect(Math.abs(day.kcal! - TARGETS.kcal * 0.75) / (TARGETS.kcal * 0.75)).toBeLessThan(0.15);
});

test('Shuffle changes that meal’s dish and leaves the others alone', () => {
  const choices = suggestPrep(CANDIDATES, DEFAULT_PREP.slots, TARGETS, seededRandom(3));
  const next = shuffleSlot(CANDIDATES, choices, 'lunch', TARGETS, seededRandom(4));
  expect(next.find((x) => x.slot === 'lunch')!.id).not.toBe(choices.find((x) => x.slot === 'lunch')!.id);
  expect(next.filter((x) => x.slot !== 'lunch')).toEqual(choices.filter((x) => x.slot !== 'lunch'));
});

test('totals: each meal for its portions, the day, and the whole prep', () => {
  const map = new Map(CANDIDATES.map((x) => [`template:${x.id}`, x]));
  const totals = prepTotals(
    [
      { slot: 'lunch', kind: 'template', id: 'chicken-rice', portions: 1.5 },
      { slot: 'dinner', kind: 'template', id: 'chilli', portions: 1 },
    ],
    map,
    4,
  );
  expect(totals.perMeal.lunch!.kcal).toBe(900);
  expect(totals.perDay.kcal).toBe(1550);
  expect(totals.whole.kcal).toBe(6200);
  expect(totals.whole.proteinG).toBe((75 + 48) * 4);
});
