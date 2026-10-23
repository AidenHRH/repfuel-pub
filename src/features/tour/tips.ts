import type { TipId } from '@/domain/tips';

import type { TargetId } from './steps';

export type Tip = { id: TipId; target: TargetId; title: string; text: string };

/** Helpful tips, each pointing at the thing it describes. Listed in the order they're offered on a shared screen. */
export const TIPS: Tip[] = [
  {
    id: 'scan',
    target: 'log-food-scan',
    title: 'Scan a barcode',
    text: 'The quickest way to log: point the camera at the pack.',
  },
  {
    id: 'snackTiles',
    target: 'log-food-meal',
    title: 'Snack tiles',
    text: 'Log a snack with Add to Snacks on, and it becomes a one-tap tile on Log food.',
  },
  { id: 'howMany', target: 'product-how-many', title: 'How many', text: 'Tap + or type a number: 3 handfuls, 2 cans.' },
  {
    id: 'classes',
    target: 'log-workout-class',
    title: 'Classes',
    text: 'Hyrox, spin or a run: log the class and how hard it felt.',
  },
  {
    id: 'effort',
    target: 'log-workout-effort',
    title: 'Effort',
    text: 'Rate each set 1–10 so RepFuel can see when you’re ready for more.',
  },
  {
    id: 'creatine',
    target: 'settings-reminders',
    title: 'Creatine reminder',
    text: 'A daily nudge, with a Taken button and a streak on Summary.',
  },
  {
    id: 'mealPlan',
    target: 'nutrition-plan',
    title: 'Meal plan',
    text: 'A week of meals sized to your targets, with a shopping list.',
  },
  {
    id: 'backup',
    target: 'settings-backup',
    title: 'Back up',
    text: 'Save everything to a file, so a new phone loses nothing.',
  },
];
