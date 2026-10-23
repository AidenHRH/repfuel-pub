import { monthTicks, niceBounds, plot } from '@/domain/chartScale';

test('plot spreads points across the width and maps values to height, top = high', () => {
  expect(plot([0, 5, 10], 200, 100, { min: 0, max: 10 })).toEqual([
    { i: 0, x: 0, y: 100 },
    { i: 1, x: 100, y: 50 },
    { i: 2, x: 200, y: 0 },
  ]);
});

test('unknown values have no point', () => {
  expect(plot([4, null, 6], 100, 10, { min: 4, max: 6 })).toEqual([
    { i: 0, x: 0, y: 10 },
    { i: 2, x: 100, y: 0 },
  ]);
});

test('a single value sits in the middle', () => {
  expect(plot([7], 100, 50, { min: 7, max: 7 })).toEqual([{ i: 0, x: 50, y: 25 }]);
});

test('nice bounds pad the range to round numbers', () => {
  expect(niceBounds([86.3, 96.1])).toEqual({ min: 84, max: 98 });
  expect(niceBounds([6.7, 7.8], { floor: 1, ceil: 10, minStep: 1 })).toEqual({ min: 6, max: 8 });
  expect(niceBounds([], { floor: 0 })).toEqual({ min: 0, max: 1 });
});

test('month ticks: the first week of each month', () => {
  expect(monthTicks(['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-10-05'])).toEqual([
    { i: 0, label: 'Aug' },
    { i: 2, label: 'Sep' },
    { i: 4, label: 'Oct' },
  ]);
});
