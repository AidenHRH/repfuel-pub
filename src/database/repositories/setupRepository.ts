import type { Activity, Goal, SetupAnswers, Sex } from '@/domain/suggestTargets';
import { GOAL_LABELS } from '@/domain/suggestTargets';

import type { Db } from '../Db';

import { updateProfile } from './profileRepository';
import { getSetting, setSetting } from './settingsRepository';
import { getCurrentTargets, setTargets } from './targetsRepository';

export type SetupState = { done: boolean; sex?: Sex; activity?: Activity; goal?: Goal };

/** Whether this phone has been through the welcome setup (phones with data from before it count as done). */
export async function getSetup(db: Db): Promise<SetupState> {
  return getSetting<SetupState>(db, 'setup', { done: false });
}

/** Saves the welcome answers: the profile, targets from now on, and the setup as done. */
export async function completeSetup(
  db: Db,
  answers: SetupAnswers & { bodyFatPercentage: number | null },
  targets: { kcal: number; proteinG: number },
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async () => {
    await updateProfile(db, {
      age: answers.age,
      heightCm: answers.heightCm,
      currentWeightKg: answers.weightKg,
      bodyFatPercentage: answers.bodyFatPercentage,
      bodyFatIsEstimate: true,
      primaryGoal: GOAL_LABELS[answers.goal],
    });
    const current = await getCurrentTargets(db, now);
    await setTargets(db, {
      caloriesKcal: targets.kcal,
      proteinGrams: targets.proteinG,
      carbohydratesGrams: current.carbohydratesGrams,
      fatGrams: current.fatGrams,
      effectiveFrom: now.toISOString(),
    });
    await setSetting(db, 'setup', { done: true, sex: answers.sex, activity: answers.activity, goal: answers.goal });
  });
}
