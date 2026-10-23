import { friendlyNumber } from './format';

/** How the owner takes creatine: the usual amount a day, and what one scoop holds. */
export type CreatineSettings = { dailyG: number; scoopG: 2.5 | 5 };

export const DEFAULT_CREATINE: CreatineSettings = { dailyG: 5, scoopG: 5 };

/** Quick amounts in How much creatine? */
export const CREATINE_DOSES = [2.5, 5, 10];

const STEP_G = 2.5;
const MAX_DAILY_G = 25;

/** The daily amount one step (2.5 g) up or down, between 2.5 and 25 g. */
export function stepDaily(dailyG: number, direction: 1 | -1): number {
  return Math.min(MAX_DAILY_G, Math.max(STEP_G, dailyG + direction * STEP_G));
}

/** "2 scoops", "½ scoop". */
export function scoopsLabel(grams: number, scoopG: number): string {
  const scoops = grams / scoopG;
  return `${friendlyNumber(scoops)} scoop${scoops === 1 || scoops < 1 ? '' : 's'}`;
}

/** What Taken adds: the rest of the daily amount (all of it if nothing yet). */
export function topUp(takenG: number | null, dailyG: number): number {
  return Math.max(0, dailyG - (takenG ?? 0));
}

/** "5 of 10 g today", "10 g today"; "Taken today" for a day ticked before amounts were kept; null if none yet. */
export function creatineCaption({
  done,
  takenG,
  dailyG,
}: {
  done: boolean;
  takenG: number | null;
  dailyG: number;
}): string | null {
  if (!done) return null;
  if (takenG === null) return 'Taken today';
  return takenG < dailyG ? `${friendlyNumber(takenG)} of ${friendlyNumber(dailyG)} g today` : `${friendlyNumber(takenG)} g today`;
}
