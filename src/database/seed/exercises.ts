import type { Equipment, MuscleGroup } from '@/domain/exercises';

type Seed = [name: string, group: MuscleGroup, equipment: Equipment, bodyweight?: true];

// The starter library. Ids are derived from names and must never change once shipped.
export const STARTER_EXERCISES: Seed[] = [
  // Chest
  ['Barbell bench press', 'chest', 'barbell'],
  ['Incline barbell bench press', 'chest', 'barbell'],
  ['Decline barbell bench press', 'chest', 'barbell'],
  ['Dumbbell bench press', 'chest', 'dumbbell'],
  ['Incline dumbbell press', 'chest', 'dumbbell'],
  ['Dumbbell fly', 'chest', 'dumbbell'],
  ['Cable fly', 'chest', 'cable'],
  ['Low-to-high cable fly', 'chest', 'cable'],
  ['High-to-low cable fly', 'chest', 'cable'],
  ['Pec deck', 'chest', 'machine'],
  ['Machine chest press', 'chest', 'machine'],
  ['Smith machine incline press', 'chest', 'machine'],
  ['Chest dip', 'chest', 'bodyweight', true],
  ['Push-up', 'chest', 'bodyweight', true],
  // Back
  ['Deadlift', 'back', 'barbell'],
  ['Barbell row', 'back', 'barbell'],
  ['Pendlay row', 'back', 'barbell'],
  ['T-bar row', 'back', 'barbell'],
  ['One-arm dumbbell row', 'back', 'dumbbell'],
  ['Chest-supported dumbbell row', 'back', 'dumbbell'],
  ['Lat pulldown', 'back', 'cable'],
  ['Close-grip lat pulldown', 'back', 'cable'],
  ['Seated cable row', 'back', 'cable'],
  ['Straight-arm pulldown', 'back', 'cable'],
  ['Machine row', 'back', 'machine'],
  ['Pull-up', 'back', 'bodyweight', true],
  ['Chin-up', 'back', 'bodyweight', true],
  ['Back extension', 'back', 'bodyweight', true],
  // Shoulders
  ['Overhead press', 'shoulders', 'barbell'],
  ['Seated dumbbell shoulder press', 'shoulders', 'dumbbell'],
  ['Arnold press', 'shoulders', 'dumbbell'],
  ['Dumbbell lateral raise', 'shoulders', 'dumbbell'],
  ['Cable lateral raise', 'shoulders', 'cable'],
  ['Machine lateral raise', 'shoulders', 'machine'],
  ['Rear delt fly', 'shoulders', 'dumbbell'],
  ['Reverse pec deck', 'shoulders', 'machine'],
  ['Face pull', 'shoulders', 'cable'],
  ['Front raise', 'shoulders', 'dumbbell'],
  ['Machine shoulder press', 'shoulders', 'machine'],
  ['Upright row', 'shoulders', 'barbell'],
  // Biceps
  ['Barbell curl', 'biceps', 'barbell'],
  ['EZ-bar curl', 'biceps', 'ez_bar'],
  ['Dumbbell curl', 'biceps', 'dumbbell'],
  ['Hammer curl', 'biceps', 'dumbbell'],
  ['Incline dumbbell curl', 'biceps', 'dumbbell'],
  ['Preacher curl', 'biceps', 'ez_bar'],
  ['Cable curl', 'biceps', 'cable'],
  ['Concentration curl', 'biceps', 'dumbbell'],
  ['Spider curl', 'biceps', 'dumbbell'],
  ['Bayesian cable curl', 'biceps', 'cable'],
  // Triceps
  ['Close-grip bench press', 'triceps', 'barbell'],
  ['EZ-bar skull crusher', 'triceps', 'ez_bar'],
  ['Cable triceps pushdown', 'triceps', 'cable'],
  ['Rope pushdown', 'triceps', 'cable'],
  ['Overhead cable triceps extension', 'triceps', 'cable'],
  ['Overhead dumbbell triceps extension', 'triceps', 'dumbbell'],
  ['Dumbbell kickback', 'triceps', 'dumbbell'],
  ['Triceps dip', 'triceps', 'bodyweight', true],
  ['Diamond push-up', 'triceps', 'bodyweight', true],
  // Legs
  ['Back squat', 'legs', 'barbell'],
  ['Front squat', 'legs', 'barbell'],
  ['Romanian deadlift', 'legs', 'barbell'],
  ['Hip thrust', 'legs', 'barbell'],
  ['Bulgarian split squat', 'legs', 'dumbbell'],
  ['Walking lunge', 'legs', 'dumbbell'],
  ['Goblet squat', 'legs', 'dumbbell'],
  ['Leg press', 'legs', 'machine'],
  ['Hack squat', 'legs', 'machine'],
  ['Leg extension', 'legs', 'machine'],
  ['Lying leg curl', 'legs', 'machine'],
  ['Seated leg curl', 'legs', 'machine'],
  ['Standing calf raise', 'legs', 'machine'],
  ['Seated calf raise', 'legs', 'machine'],
  ['Hip abduction', 'legs', 'machine'],
  ['Step-up', 'legs', 'dumbbell'],
  // Core
  ['Plank', 'core', 'bodyweight', true],
  ['Hanging leg raise', 'core', 'bodyweight', true],
  ['Cable crunch', 'core', 'cable'],
  ['Ab wheel rollout', 'core', 'other'],
  ['Russian twist', 'core', 'bodyweight', true],
  ['Pallof press', 'core', 'cable'],
  ['Decline sit-up', 'core', 'bodyweight', true],
  ['Dead bug', 'core', 'bodyweight', true],
  // Full body
  ['Kettlebell swing', 'full_body', 'kettlebell'],
  ['Power clean', 'full_body', 'barbell'],
  ['Thruster', 'full_body', 'barbell'],
  ['Farmer’s carry', 'full_body', 'dumbbell'],
  ['Burpee', 'full_body', 'bodyweight', true],
  ['Sled push', 'full_body', 'other'],
];

export function exerciseId(name: string): string {
  return `ex_${name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')}`;
}
