import { prepSession, type PrepMeal } from '@/domain/mealPrep';
import { getMealTemplate } from '@/domain/mealTemplates';

const meal = (id: string, daysAhead: number, slot: PrepMeal['slot'], portions = 1): PrepMeal => ({
  day: `2026-10-${23 + daysAhead - 1}`,
  daysAhead,
  dayLabel: `Day ${daysAhead}`,
  slot,
  portions,
  meal: { kind: 'template', template: getMealTemplate(id)! },
});

test('one session: cooking totals first, longest jobs first, then a box per meal', () => {
  const s = prepSession([
    meal('salmon-rice-broccoli', 1, 'dinner'),
    meal('chicken-sweet-potato', 2, 'dinner', 1.5),
    meal('chicken-wrap', 1, 'lunch'),
  ]);
  expect(s.steps.map((x) => x.title)).toEqual([
    'Roast the sweet potato',
    'Cook brown rice',
    'Bake the salmon',
    'Cook the chicken',
    'Steam the broccoli',
    'Cook the peas',
    'Chop the veg',
    'Pack 3 boxes',
  ]);
  // 150 g × 1.5 for dinner plus 100 g for the wrap.
  expect(s.steps.find((x) => x.title === 'Cook the chicken')!.detail).toMatch(/^325 g, until steaming hot/);
  expect(s.steps.find((x) => x.title === 'Cook brown rice')!.detail).toBe('180 g cooked (about 70 g dry)');

  const wrap = s.boxes.find((b) => b.name.startsWith('Chicken & hummus wrap'))!;
  expect(wrap.contents).toBe('Chicken breast 100 g · Tomato 60 g');
  expect(wrap.onTheDay).toBe('Add on the day: Tortilla wrap, Hummus, Spinach');
  expect(s.boxes.find((b) => b.name.startsWith('Chicken, sweet potato'))!.name).toBe(
    'Chicken, sweet potato & peas (1½ portions)',
  );
});

test('boxes go in the freezer when they would be kept too long (rice: a day; anything else: two)', () => {
  const s = prepSession([
    meal('salmon-rice-broccoli', 1, 'dinner'),
    meal('salmon-rice-broccoli', 2, 'dinner'),
    meal('chicken-sweet-potato', 2, 'dinner'),
    meal('chicken-sweet-potato', 3, 'dinner'),
  ]);
  expect(s.boxes.map((b) => b.store)).toEqual(['fridge', 'freezer', 'fridge', 'freezer']);
});

test('breakfasts and snacks are made on the day; your own meals are one step', () => {
  const s = prepSession([
    meal('porridge-banana', 1, 'breakfast'),
    meal('apple-pb', 1, 'snack'),
    {
      day: '2026-10-23',
      daysAhead: 1,
      dayLabel: 'Fri',
      slot: 'lunch',
      portions: 1,
      meal: { kind: 'recipe', id: 'r1', name: 'Pico salad' },
    },
    {
      day: '2026-10-24',
      daysAhead: 2,
      dayLabel: 'Sat',
      slot: 'lunch',
      portions: 2,
      meal: { kind: 'recipe', id: 'r1', name: 'Pico salad' },
    },
  ]);
  expect(s.madeOnTheDay.map((m) => m.name)).toEqual(['Porridge with banana', 'Apple & peanut butter']);
  expect(s.steps[0]).toEqual({ key: 'recipe:r1', title: 'Make Pico salad', detail: '3 portions in all' });
  expect(s.boxes.map((b) => `${b.label}: ${b.name}`)).toEqual([
    'Fri · Lunch: Pico salad',
    'Sat · Lunch: Pico salad (2 portions)',
  ]);
});

test('salads too far ahead for the fridge are made on the day, not frozen', () => {
  const s = prepSession([meal('chickpea-salad', 2, 'lunch'), meal('chickpea-salad', 3, 'lunch')]);
  expect(s.boxes.map((b) => b.store)).toEqual(['fridge']);
  expect(s.madeOnTheDay.map((m) => m.name)).toEqual(['Chickpea salad (too far ahead to keep)']);
  expect(s.steps.find((x) => x.title === 'Drain and rinse the chickpeas')!.detail).toMatch(/^120 g/);
});
