import { useCallback, useContext } from 'react';

import type { TargetView } from './measure';
import type { TargetId } from './steps';
import { TourContext } from './TourProvider';

/** Tags a view the tour or a tip can point at (or nothing, for null): spread the result onto a `View`. */
export function useTourTarget(id: TargetId | null) {
  const ctx = useContext(TourContext);
  const ref = useCallback((view: TargetView | null) => (id ? ctx?.register(id, view) : undefined), [ctx, id]);
  const onLayout = useCallback(() => (id ? ctx?.relayout(id) : undefined), [ctx, id]);
  return { ref, onLayout, collapsable: false as const };
}
