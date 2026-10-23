import { useLocalSearchParams } from 'expo-router';

import { LogWorkout } from '@/features/workouts/LogWorkout';

export default function NewLiftScreen() {
  const { from, mode } = useLocalSearchParams<{ from?: string; mode?: string }>();
  return <LogWorkout from={from === 'today' ? 'today' : 'workouts'} initialMode={mode === 'class' ? 'class' : 'exercise'} />;
}
