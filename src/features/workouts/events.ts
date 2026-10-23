import type { RecordEvent } from '@/domain/records';

/** `from` says which screen opened the lift logger, so only that screen confirms the save. */
type WorkoutEvent = { type: 'changed' } | { type: 'logged'; name: string; records: RecordEvent[]; from: 'today' | 'workouts' };
type Listener = (event: WorkoutEvent) => void;

const listeners = new Set<Listener>();

/** Lets the lift editor tell Workouts and Progress to refresh, and Workouts to celebrate PRs. */
export const workoutEvents = {
  emit(event: WorkoutEvent) {
    listeners.forEach((l) => l(event));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
