import type { UserProfile } from '@/domain/types';

import type { Db } from '../Db';
import { nowIso } from '../ids';

type Row = {
  id: string;
  age: number;
  height_cm: number;
  current_weight_kg: number;
  body_fat_percentage: number | null;
  body_fat_is_estimate: number;
  primary_goal: string;
  created_at: string;
  updated_at: string;
};

function toProfile(row: Row): UserProfile {
  return {
    id: row.id,
    age: row.age,
    heightCm: row.height_cm,
    currentWeightKg: row.current_weight_kg,
    bodyFatPercentage: row.body_fat_percentage,
    bodyFatIsEstimate: row.body_fat_is_estimate === 1,
    primaryGoal: row.primary_goal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProfile(db: Db): Promise<UserProfile> {
  const row = await db.getFirst<Row>('SELECT * FROM user_profile ORDER BY created_at LIMIT 1');
  if (!row) throw new Error('No user profile found; migrations have not run.');
  return toProfile(row);
}

export type ProfilePatch = Partial<Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>>;

export async function updateProfile(db: Db, patch: ProfilePatch): Promise<UserProfile> {
  const merged = { ...(await getProfile(db)), ...patch };
  await db.run(
    `UPDATE user_profile
     SET age = ?, height_cm = ?, current_weight_kg = ?, body_fat_percentage = ?, body_fat_is_estimate = ?, primary_goal = ?, updated_at = ?
     WHERE id = ?`,
    [
      merged.age,
      merged.heightCm,
      merged.currentWeightKg,
      merged.bodyFatPercentage,
      merged.bodyFatIsEstimate ? 1 : 0,
      merged.primaryGoal,
      nowIso(),
      merged.id,
    ],
  );
  return getProfile(db);
}
