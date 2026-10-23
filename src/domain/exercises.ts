export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'core' | 'full_body' | 'other';

export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'ez_bar' | 'bodyweight' | 'kettlebell' | 'band' | 'other';

/** How an exercise is logged: weight × reps, reps only (ab wheel, push-ups), or a time (plank). */
export type Tracking = 'weight_reps' | 'reps' | 'time';

export const TRACKING_LABELS: Record<Tracking, string> = { weight_reps: 'Weight & reps', reps: 'Reps only', time: 'Timed' };

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  isBodyweight: boolean;
  isCustom: boolean;
  tracking: Tracking;
  /** The owner's how-to video (a YouTube link), or null. */
  videoUrl: string | null;
};

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  core: 'Core',
  full_body: 'Full body',
  other: 'Other',
};
