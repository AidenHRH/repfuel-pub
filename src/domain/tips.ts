/** Helpful tips: one-off spotlight notes for features not used lately, shown rarely and only once each. */
export type TipId = 'scan' | 'howMany' | 'snackTiles' | 'classes' | 'effort' | 'creatine' | 'mealPlan' | 'backup';

/** The tour and tips, as kept on the phone. */
export type TourState = { doneAt: string | null; tipsOn: boolean; shown: TipId[]; lastTipAt: string | null };

export const DEFAULT_TOUR_STATE: TourState = { doneAt: null, tipsOn: true, shown: [], lastTipAt: null };

/** Features whose last use is noted (ISO time) so tips can tell what hasn't been used lately. */
export type Feature = 'scan' | 'howMany' | 'backup';
export type Usage = Partial<Record<Feature, string>>;

/** What the tips need to know about how the app has been used. */
export type TipFacts = {
  usage: Usage;
  snackTiles: number;
  classes: number;
  effortSets: number;
  creatineOn: boolean;
  plans: number;
  /** The first thing ever logged (food, a set or a class). */
  firstUseAt: string | null;
};

const DAY = 86_400_000;
const daysSince = (iso: string | null | undefined, now: Date) => (iso ? (now.getTime() - Date.parse(iso)) / DAY : Infinity);

/** Whether a tip still has something to teach: its feature hasn't been used (lately). */
export function tipWanted(id: TipId, facts: TipFacts, now: Date): boolean {
  switch (id) {
    case 'scan':
      return daysSince(facts.usage.scan, now) > 14;
    case 'howMany':
      return !facts.usage.howMany;
    case 'snackTiles':
      return facts.snackTiles === 0;
    case 'classes':
      return facts.classes === 0;
    case 'effort':
      return facts.effortSets < 3;
    case 'creatine':
      return !facts.creatineOn;
    case 'mealPlan':
      return facts.plans === 0;
    case 'backup':
      return facts.firstUseAt !== null && daysSince(facts.firstUseAt, now) >= 30 && daysSince(facts.usage.backup, now) > 30;
  }
}

/** Pacing: tips on, at least a day after the tour, at least 3 days after the last tip, and each tip only once. */
export function canShowTip(id: TipId, state: TourState, now: Date): boolean {
  return (
    state.tipsOn &&
    state.doneAt !== null &&
    daysSince(state.doneAt, now) >= 1 &&
    daysSince(state.lastTipAt, now) >= 3 &&
    !state.shown.includes(id)
  );
}
