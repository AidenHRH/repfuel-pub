import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Button } from './Button';

const FLOATING = { height: 52, paddingHorizontal: spacing.xl, boxShadow: '0px 10px 28px rgba(0,0,0,0.28)' };

/** The main actions as pills floating at the bottom of a screen, where thumbs are. */
export function FloatingPills({
  actions,
}: {
  actions: { label: string; icon: ReactNode; onPress: () => void; accessibilityLabel?: string }[];
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: spacing.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
      }}>
      {actions.map((a) => (
        <Button
          key={a.label}
          label={a.label}
          accessibilityLabel={a.accessibilityLabel}
          onPress={a.onPress}
          style={FLOATING}
          icon={a.icon}
        />
      ))}
    </View>
  );
}
