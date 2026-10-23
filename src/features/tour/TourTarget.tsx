import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { TargetId } from './steps';
import { useTourTarget } from './useTourTarget';

/** Wraps something the tour or a tip can point at. */
export function TourTarget({ id, style, children }: { id: TargetId | null; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <View {...useTourTarget(id)} style={style}>
      {children}
    </View>
  );
}
