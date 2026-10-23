/** Answers from the welcome setup used to suggest starting targets. */
export type Sex = 'male' | 'female' | 'unspecified';
export type Activity = 'low' | 'light' | 'moderate' | 'very';
export type Goal = 'lose' | 'maintain' | 'build';

export type SetupAnswers = {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: Sex;
  activity: Activity;
  goal: Goal;
};

export type BmiBand = 'underweight' | 'healthy' | 'overweight' | 'obese';

export type SuggestedTargets = {
  kcal: number;
  proteinG: number;
  /** Estimated calories burned a day. */
  maintenanceKcal: number;
  bmi: number;
  band: BmiBand;
  /** Expected weight change a week at this target, in kg (negative = losing), to the nearest 0.25. */
  weeklyChangeKg: number;
  /** Plain-English reasons for anything adjusted. */
  notes: string[];
};

export const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.2, light: 1.375, moderate: 1.55, very: 1.725 };

export const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose fat',
  maintain: 'Stay where I am',
  build: 'Build muscle',
};

/** Weight (kg) over height (m) squared, to one decimal. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** The NHS adult bands. */
export function bmiBand(value: number): BmiBand {
  if (value < 18.5) return 'underweight';
  if (value < 25) return 'healthy';
  if (value < 30) return 'overweight';
  return 'obese';
}

/** Mifflin-St Jeor resting energy; "prefer not to say" takes the midpoint of the two. */
function restingKcal({ age, heightCm, weightKg, sex }: SetupAnswers): number {
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + offset;
}

/** A target nobody should go under without medical support. */
const FLOOR: Record<Sex, number> = { male: 1500, female: 1200, unspecified: 1350 };

/** Grams of protein per kg, by goal: within the 1.6–2.2 g/kg range for people who lift. */
const PROTEIN_PER_KG: Record<Goal, number> = { lose: 1.8, maintain: 1.6, build: 1.8 };

const KCAL_PER_KG = 7700;
const to = (x: number, step: number) => Math.round(x / step) * step;

/**
 * Starting targets that are realistic to keep up: losing is at most 500 kcal (and 20%) under the estimated burn,
 * never below a safe floor; building is a 250 kcal surplus; protein uses a healthy-BMI weight when BMI is over 25.
 */
export function suggestTargets(answers: SetupAnswers): SuggestedTargets {
  const value = bmi(answers.weightKg, answers.heightCm);
  const band = bmiBand(value);
  const resting = restingKcal(answers);
  const maintenance = resting * ACTIVITY_FACTOR[answers.activity];
  const notes: string[] = [];

  let goal = answers.goal;
  if (goal === 'lose' && band === 'underweight') {
    goal = 'maintain';
    notes.push('Your BMI is in the underweight range, so this keeps your calories at maintenance rather than cutting.');
  }

  let kcal = maintenance;
  if (goal === 'lose') {
    const floor = Math.min(Math.max(resting, FLOOR[answers.sex]), maintenance);
    kcal = Math.max(maintenance - Math.min(500, maintenance * 0.2), floor);
  } else if (goal === 'build') {
    kcal = maintenance + 250;
  }

  const m = answers.heightCm / 100;
  const proteinWeight = value > 25 ? 25 * m * m : answers.weightKg;
  if (value > 25)
    notes.push('Protein is based on a healthy weight for your height, which is plenty for building and keeping muscle.');

  const kcalRounded = to(kcal, 50);
  const maintenanceRounded = to(maintenance, 50);
  return {
    kcal: kcalRounded,
    proteinG: to(proteinWeight * PROTEIN_PER_KG[goal], 5),
    maintenanceKcal: maintenanceRounded,
    bmi: value,
    band,
    weeklyChangeKg: to(((kcal - maintenance) * 7) / KCAL_PER_KG, 0.25) || 0,
    notes,
  };
}
