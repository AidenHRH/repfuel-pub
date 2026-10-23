import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { palettes, radii, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Action = { label: string; onPress: () => void };

type Props = {
  message: string;
  actions: Action[];
  onTimeout: () => void;
  timeoutMs?: number;
  bottom?: number;
};

/** Brief confirmation with quick actions (Undo, Adjust). Inverted colours so it stands out. */
export function Snackbar({ message, actions, onTimeout, timeoutMs = 4500, bottom = spacing.lg }: Props) {
  const { name } = useTheme();
  const inverse = palettes[name === 'dark' ? 'light' : 'dark'];

  useEffect(() => {
    const timer = setTimeout(onTimeout, timeoutMs);
    return () => clearTimeout(timer);
    // Restart only when the message changes; a new handler identity alone shouldn't extend it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, timeoutMs]);

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom,
        backgroundColor: inverse.card,
        borderRadius: radii.card - 2,
        paddingLeft: spacing.lg,
        paddingRight: spacing.xs,
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        boxShadow: '0px 10px 30px rgba(0,0,0,0.3)',
      }}>
      <Text variant="callout" numberOfLines={1} style={{ flex: 1, color: inverse.text }}>
        {message}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={{ minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center' }}>
            <Text variant="headline" style={{ fontSize: 15, color: inverse.pro }}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}
