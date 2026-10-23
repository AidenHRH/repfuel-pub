import type { ComponentRef } from 'react';
import type { View } from 'react-native';

/** A mounted view that can be measured. */
export type TargetView = ComponentRef<typeof View>;

export type Rect = { x: number; y: number; width: number; height: number };

/** Where a target is on screen, or null if it has no size (or doesn't answer). */
export function measureTarget(view: TargetView, _id: string): Promise<Rect | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 300);
    view.measureInWindow((x, y, width, height) => {
      clearTimeout(timer);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}
