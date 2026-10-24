import { addDays, dayTitle, hadLabel, weekOf, localDayKey } from '@/domain/dates';

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

describe('days for Summary', () => {
  test('addDays crosses months and the clocks going back', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-10-25', -1)).toBe('2026-10-24');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('weekOf runs Monday to Sunday', () => {
    expect(weekOf('2026-10-22')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(weekOf('2026-10-25')[0]).toBe('2026-10-19');
  });

  test('dayTitle says Today, Yesterday, else the date', () => {
    expect(dayTitle('2026-10-22', '2026-10-22')).toBe('Today');
    expect(dayTitle('2026-10-21', '2026-10-22')).toBe('Yesterday');
    expect(dayTitle('2026-10-19', '2026-10-22')).toBe('Mon 19 Oct');
  });
});

describe('hadLabel', () => {
  const now = new Date(2026, 9, 22, 12);
  test('today, yesterday, then the weekday within the week; nothing older', () => {
    expect(hadLabel(new Date(2026, 9, 22, 8).toISOString(), now)).toBe('You had this today');
    expect(hadLabel(new Date(2026, 9, 21, 19).toISOString(), now)).toBe('You had this yesterday');
    expect(hadLabel(new Date(2026, 9, 20, 13).toISOString(), now)).toBe('You had this Tuesday');
    expect(hadLabel(new Date(2026, 9, 16, 13).toISOString(), now)).toBe('You had this Friday');
    expect(hadLabel(new Date(2026, 9, 15, 13).toISOString(), now)).toBeNull();
  });
});
