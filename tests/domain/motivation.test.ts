import { LINES, lineForDay } from '@/domain/motivation';

test('there are plenty of distinct lines', () => {
  expect(LINES.length).toBeGreaterThanOrEqual(40);
  expect(new Set(LINES).size).toBe(LINES.length);
});

test('the same day always gets the same line', () => {
  expect(lineForDay('2026-10-22')).toBe(lineForDay('2026-10-22'));
});

test('no line repeats within a run of days as long as the list', () => {
  const start = new Date('2026-01-01T12:00:00Z');
  const seen = Array.from({ length: LINES.length }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return lineForDay(d.toISOString().slice(0, 10));
  });
  expect(new Set(seen).size).toBe(LINES.length);
});
