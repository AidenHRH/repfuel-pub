import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radii, spacing } from '@/theme/tokens';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'plain';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', disabled, haptic, accessibilityLabel, icon, style }: Props) {
  const { colors } = useTheme();
  const background = variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.well : 'transparent';
  const textColor = variant === 'primary' ? 'onAccent' : 'accent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={variant === 'plain' ? 8 : 0}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: layout.minTouch,
          paddingHorizontal: variant === 'plain' ? spacing.xs : spacing.xl,
          borderRadius: radii.pill,
          backgroundColor: background,
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        style,
      ]}>
      {icon}
      <Text variant="headline" color={textColor} style={{ fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}
