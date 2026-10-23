import { reminderTimes, timeLabel, shiftTime } from '@/domain/reminders';

const at = (iso: string) => new Date(iso);
const local = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${timeLabel(d.getHours(), d.getMinutes())}`;

test('the next two weeks of reminders at the chosen local time, starting today if it is still ahead', () => {
  const times = reminderTimes({ hour: 8, minute: 30, now: at('2026-10-22T06:00:00Z'), takenToday: false }); // 07:00 London
  expect(times).toHaveLength(14);
  expect(local(times[0])).toBe('2026-10-22 08:30');
  expect(local(times[13])).toBe('2026-11-04 08:30');
});

test('starts tomorrow once today’s time has passed, or it was already taken', () => {
  expect(local(reminderTimes({ hour: 8, minute: 0, now: at('2026-10-22T09:00:00Z'), takenToday: false })[0])).toBe(
    '2026-10-23 08:00',
  );
  expect(local(reminderTimes({ hour: 20, minute: 0, now: at('2026-10-22T09:00:00Z'), takenToday: true })[0])).toBe(
    '2026-10-23 20:00',
  );
});

test('keeps the local time across the clocks going back', () => {
  // UK clocks go back on 25 October 2026.
  const times = reminderTimes({ hour: 8, minute: 0, now: at('2026-10-24T05:00:00Z'), takenToday: false });
  expect(times.slice(0, 3).map(local)).toEqual(['2026-10-24 08:00', '2026-10-25 08:00', '2026-10-26 08:00']);
});

test('times read as a 24-hour clock and step by 15 minutes around the day', () => {
  expect(timeLabel(8, 5)).toBe('08:05');
  expect(shiftTime({ hour: 8, minute: 0 }, 15)).toEqual({ hour: 8, minute: 15 });
  expect(shiftTime({ hour: 23, minute: 45 }, 15)).toEqual({ hour: 0, minute: 0 });
  expect(shiftTime({ hour: 0, minute: 0 }, -15)).toEqual({ hour: 23, minute: 45 });
});
