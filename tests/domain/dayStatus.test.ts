import { dayStatus, drinksSummary, logTimeFor, streak, type DayStage } from '@/domain/dayStatus';
import type { FoodLogEntry, MealCategory, NutritionTargets } from '@/domain/types';

const targets = { caloriesKcal: 2500, proteinGrams: 145 } as NutritionTargets;
let n = 0;
const entry = (meal: MealCategory, kcal: number, proteinG: number, unit: FoodLogEntry['unit'] = 'serving'): FoodLogEntry => ({
  id: `e${(n += 1)}`,
  foodId: 'f',
  recipeId: null,
  name: 'Food',
  amount: 1,
  unit,
  nutrients: { kcal, proteinG, carbsG: null, fatG: null, fibreG: null },
  isApproximate: false,
  loggedAt: '2026-10-20T12:00:00.000Z',
  localDay: '2026-10-20',
  mealCategory: meal,
  notes: null,
});

describe('dayStatus', () => {
  test('nothing logged is empty', () => {
    expect(dayStatus([], targets, [])).toEqual({ stage: 'empty', mealsDone: 0 });
  });

  test('some of breakfast, lunch and dinner logged is partial; snacks and drinks do not count as meals', () => {
    expect(dayStatus([entry('breakfast', 500, 40), entry('snack', 200, 5)], targets, [])).toEqual({
      stage: 'partial',
      mealsDone: 1,
    });
  });

  test('all three meals logged: hit when protein reaches the target and calories are within 10%', () => {
    const day = [entry('breakfast', 600, 40), entry('lunch', 800, 50), entry('dinner', 1000, 60)];
    expect(dayStatus(day, targets, []).stage).toBe('hit');
  });

  test('all three logged but protein short or calories over 10% out is missed', () => {
    expect(dayStatus([entry('breakfast', 600, 30), entry('lunch', 800, 50), entry('dinner', 1000, 60)], targets, []).stage).toBe(
      'missed',
    );
    expect(dayStatus([entry('breakfast', 900, 50), entry('lunch', 900, 50), entry('dinner', 1100, 60)], targets, []).stage).toBe(
      'missed',
    );
  });

  test('a meal marked skipped counts as done', () => {
    const day = [entry('lunch', 1200, 80), entry('dinner', 1200, 70)];
    expect(dayStatus(day, targets, ['breakfast'])).toEqual({ stage: 'hit', mealsDone: 3 });
  });

  test('unknown calories never count as on target', () => {
    const day = [
      entry('breakfast', 600, 50),
      entry('lunch', 800, 50),
      { ...entry('dinner', 0, 60), nutrients: { kcal: null, proteinG: 60, carbsG: null, fatG: null, fibreG: null } },
    ];
    expect(dayStatus(day, targets, []).stage).toBe('missed');
  });
});

test('streak counts goal-hit days back from today; today still in progress does not break it', () => {
  const stages: Record<string, DayStage> = {
    '2026-10-17': 'hit',
    '2026-10-18': 'missed',
    '2026-10-19': 'hit',
    '2026-10-20': 'hit',
    '2026-10-21': 'hit',
    '2026-10-22': 'partial',
  };
  expect(streak(stages, '2026-10-22')).toBe(3);
  expect(streak({ ...stages, '2026-10-22': 'hit' }, '2026-10-22')).toBe(4);
  expect(streak({ '2026-10-20': 'hit' }, '2026-10-22')).toBe(0);
});

test('drinks: every item measured in ml, whatever meal it was in', () => {
  const day = [entry('lunch', 140, 0, 'ml'), entry('drink', 120, 6, 'ml'), entry('lunch', 500, 30, 'g')];
  expect(drinksSummary(day)).toEqual({ count: 2, kcal: 260, entries: [day[0], day[1]] });
});

describe('logTimeFor', () => {
  const now = new Date('2026-10-22T15:20:00');
  test('today is now', () => {
    expect(logTimeFor('2026-10-22', 'lunch', now)).toEqual(now);
  });
  test('a past day is that day at the meal’s usual time', () => {
    expect(logTimeFor('2026-10-21', 'dinner', now)).toEqual(new Date('2026-10-21T18:30:00'));
    expect(logTimeFor('2026-10-21', 'breakfast', now)).toEqual(new Date('2026-10-21T08:00:00'));
    expect(logTimeFor(undefined, 'snack', now)).toEqual(now);
  });
});
