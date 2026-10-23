/** Everything the tour and tips can point at. */
export type TargetId =
  | 'summary-rings'
  | 'log-food-pill'
  | 'log-workout-pill'
  | 'log-food-meal'
  | 'log-food-scan'
  | 'product-how-many'
  | 'product-log'
  | 'settings-tab'
  | 'log-workout-class'
  | 'log-workout-effort'
  | 'settings-reminders'
  | 'settings-backup'
  | 'nutrition-plan';

/** Where a stop is: the tour opens and closes these screens itself. */
export type Place = 'summary' | 'log-food' | 'product' | 'settings';

export type TourStep = { target: TargetId; place: Place; title: string; text: string };

/** The first-run tour (spec: docs/superpowers/specs/2026-10-22-tour-and-tips-design.md). */
export const TOUR_STEPS: TourStep[] = [
  {
    target: 'summary-rings',
    place: 'summary',
    title: 'Your day at a glance',
    text: 'The outer ring is calories, the inner one protein. They fill as you log.',
  },
  { target: 'log-food-pill', place: 'summary', title: 'Log food', text: 'Tap here whenever you eat or drink something.' },
  {
    target: 'log-food-meal',
    place: 'log-food',
    title: 'Which meal',
    text: 'RepFuel picks it from the time of day. Tap another to change it.',
  },
  {
    target: 'log-food-scan',
    place: 'log-food',
    title: 'Scan it',
    text: 'Point the camera at a barcode. Or tap Search food to type a food or a brand.',
  },
  {
    target: 'product-how-many',
    place: 'product',
    title: 'How much you had',
    text: 'Tap + or type a number: 3 handfuls, 2 servings. The numbers above update.',
  },
  {
    target: 'product-log',
    place: 'product',
    title: 'Log it',
    text: 'Adds it to your day. Nothing is saved until you tap this.',
  },
  {
    target: 'log-workout-pill',
    place: 'summary',
    title: 'Log workout',
    text: 'Weights, reps only, a timed hold, or a class like Hyrox with how hard it felt.',
  },
  {
    target: 'settings-tab',
    place: 'settings',
    title: 'You’re all set',
    text: 'Show this tour again any time from Settings.',
  },
];

/** The product the tour opens to show How many: a banana, with typical values. */
export const TOUR_PRODUCT = '/food/log?preset=banana';
