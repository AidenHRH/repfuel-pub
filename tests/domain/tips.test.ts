import { canShowTip, DEFAULT_TOUR_STATE, tipWanted, type TipFacts, type TourState } from '@/domain/tips';

const now = new Date('2026-11-01T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const facts = (patch: Partial<TipFacts> = {}): TipFacts => ({
  usage: {},
  snackTiles: 0,
  classes: 0,
  effortSets: 0,
  creatineOn: false,
  plans: 0,
  firstUseAt: null,
  ...patch,
});

test('Scan a barcode: wanted when nothing was scanned in the last 14 days', () => {
  expect(tipWanted('scan', facts(), now)).toBe(true);
  expect(tipWanted('scan', facts({ usage: { scan: daysAgo(15) } }), now)).toBe(true);
  expect(tipWanted('scan', facts({ usage: { scan: daysAgo(13) } }), now)).toBe(false);
});

test('How many, snack tiles, classes, meal plan and creatine: wanted until used', () => {
  expect(tipWanted('howMany', facts(), now)).toBe(true);
  expect(tipWanted('howMany', facts({ usage: { howMany: daysAgo(60) } }), now)).toBe(false);
  expect(tipWanted('snackTiles', facts({ snackTiles: 1 }), now)).toBe(false);
  expect(tipWanted('classes', facts({ classes: 1 }), now)).toBe(false);
  expect(tipWanted('mealPlan', facts({ plans: 1 }), now)).toBe(false);
  expect(tipWanted('creatine', facts({ creatineOn: true }), now)).toBe(false);
  expect(tipWanted('creatine', facts(), now)).toBe(true);
});

test('Effort: wanted while fewer than 3 sets have an effort', () => {
  expect(tipWanted('effort', facts({ effortSets: 2 }), now)).toBe(true);
  expect(tipWanted('effort', facts({ effortSets: 3 }), now)).toBe(false);
});

test('Back up: after 30 days of use, when there is no backup from the last 30 days', () => {
  expect(tipWanted('backup', facts({ firstUseAt: daysAgo(29) }), now)).toBe(false);
  expect(tipWanted('backup', facts({ firstUseAt: daysAgo(31) }), now)).toBe(true);
  expect(tipWanted('backup', facts({ firstUseAt: daysAgo(31), usage: { backup: daysAgo(10) } }), now)).toBe(false);
  expect(tipWanted('backup', facts({ firstUseAt: daysAgo(90), usage: { backup: daysAgo(31) } }), now)).toBe(true);
  expect(tipWanted('backup', facts(), now)).toBe(false);
});

test('pacing: tips on, a day after the tour, three days apart, each once', () => {
  const ok: TourState = { ...DEFAULT_TOUR_STATE, doneAt: daysAgo(5) };
  expect(canShowTip('scan', ok, now)).toBe(true);
  expect(canShowTip('scan', { ...ok, doneAt: null }, now)).toBe(false);
  expect(canShowTip('scan', { ...ok, doneAt: hoursAgo(23) }, now)).toBe(false);
  expect(canShowTip('scan', { ...ok, doneAt: hoursAgo(25) }, now)).toBe(true);
  expect(canShowTip('scan', { ...ok, lastTipAt: daysAgo(2) }, now)).toBe(false);
  expect(canShowTip('scan', { ...ok, lastTipAt: daysAgo(3) }, now)).toBe(true);
  expect(canShowTip('scan', { ...ok, shown: ['scan'] }, now)).toBe(false);
  expect(canShowTip('howMany', { ...ok, shown: ['scan'] }, now)).toBe(true);
  expect(canShowTip('scan', { ...ok, tipsOn: false }, now)).toBe(false);
});
