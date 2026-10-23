import { useLocalSearchParams } from 'expo-router';

import { LiftEditor } from '@/features/workouts/LiftEditor';

export default function EditLiftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LiftEditor workoutId={id} />;
}
