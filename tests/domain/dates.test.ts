import { localDayKey } from '@/domain/dates';

// jest.config.js pins TZ=Europe/London for the whole run.
test('tests run in Europe/London', () => {
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/London');
});

describe('localDayKey in Europe/London', () => {
  test.each([
    ['late evening in summer time belongs to the next local day', '2026-10-21T23:30:00Z', '2026-10-22'],
    ['early morning on the autumn clock-change day', '2026-10-25T00:30:00Z', '2026-10-25'],
    ['late evening after clocks go back stays on the same day', '2026-10-25T23:30:00Z', '2026-10-25'],
    ['just after midnight on the spring clock-change day', '2026-03-29T00:30:00Z', '2026-03-29'],
    ['just before midnight the evening before', '2026-03-28T23:59:00Z', '2026-03-28'],
    ['winter midnight exactly', '2026-01-15T00:00:00Z', '2026-01-15'],
  ])('%s', (_label, iso, expected) => {
    expect(localDayKey(new Date(iso))).toBe(expected);
  });
});
