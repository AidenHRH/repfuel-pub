import { creatineCaption, DEFAULT_CREATINE, scoopsLabel, stepDaily, topUp } from '@/domain/creatine';

test('a scoop is 5 g unless set to 2.5 g, and 5 g a day to start with', () => {
  expect(DEFAULT_CREATINE).toEqual({ dailyG: 5, scoopG: 5 });
});

test('the daily amount moves in 2.5 g steps, from 2.5 to 25 g', () => {
  expect(stepDaily(10, 1)).toBe(12.5);
  expect(stepDaily(5, -1)).toBe(2.5);
  expect(stepDaily(2.5, -1)).toBe(2.5);
  expect(stepDaily(25, 1)).toBe(25);
});

test('amounts in scoops', () => {
  expect(scoopsLabel(5, 2.5)).toBe('2 scoops');
  expect(scoopsLabel(2.5, 5)).toBe('½ scoop');
  expect(scoopsLabel(5, 5)).toBe('1 scoop');
  expect(scoopsLabel(10, 5)).toBe('2 scoops');
});

test('Taken tops up to the daily amount', () => {
  expect(topUp(null, 10)).toBe(10);
  expect(topUp(5, 10)).toBe(5);
  expect(topUp(10, 10)).toBe(0);
  expect(topUp(12.5, 10)).toBe(0);
});

test('what Summary says about today', () => {
  expect(creatineCaption({ done: false, takenG: null, dailyG: 10 })).toBeNull();
  expect(creatineCaption({ done: true, takenG: 5, dailyG: 10 })).toBe('5 of 10 g today');
  expect(creatineCaption({ done: true, takenG: 10, dailyG: 10 })).toBe('10 g today');
  expect(creatineCaption({ done: true, takenG: 12.5, dailyG: 10 })).toBe('12.5 g today');
  // Ticked before amounts were kept.
  expect(creatineCaption({ done: true, takenG: null, dailyG: 10 })).toBe('Taken today');
});
