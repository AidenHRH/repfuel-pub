import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { CLASS_EFFORT } from '@/domain/classes';
import { effortHaptic, effortShake, levelAt } from '@/domain/effort';
import { useTheme } from '@/theme/ThemeProvider';
import { effortScales, fonts, radii, spacing } from '@/theme/tokens';

import { Text } from './Text';

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Measurable = {
  measure?: (cb: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void;
};
const IMPACT = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
} as const;

/** Reps in reserve for a set's effort (10 = nothing left). */
export function setEffortCaption(effort: number): string {
  if (effort >= 10) return 'Nothing left';
  if (effort >= 7) return `${10 - effort} rep${effort === 9 ? '' : 's'} left in the tank`;
  return '4 or more left';
}

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
  /** `set`: ten equal buttons with reps-in-reserve; `class`: bars that grow, with the session scale. */
  variant: 'set' | 'class';
  accessibilityLabel: string;
  /** Each level's button name; defaults to "Effort 8" (set) or "8, Very hard+" (class). */
  buttonLabel?: (effort: number) => string;
};

/**
 * Effort 1–10: slide a thumb along the bars or tap one; hold a chosen bar to clear it. The bars fill from green
 * (easy) to red (nothing left), and each step answers with a haptic tick and a shake that grow with the effort
 * (no shake with Reduce Motion).
 */
export function EffortPicker({ value, onChange, variant, accessibilityLabel, buttonLabel }: Props) {
  const { colors, name: theme } = useTheme();
  const scale = effortScales[theme];
  const name = buttonLabel ?? ((e: number) => (variant === 'set' ? `Effort ${e}` : `${e}, ${CLASS_EFFORT[e].label}`));
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const shakeX = useSharedValue(0);
  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const choose = useCallback(
    (level: number) => {
      // A drag only answers when it crosses into another bar.
      if (level === value) return;
      onChange(level);
      Haptics.impactAsync(IMPACT[effortHaptic(level)]).catch(() => undefined);
      const a = reduceMotion ? 0 : effortShake(level);
      if (a > 0) {
        shakeX.set(
          withSequence(
            withTiming(a, { duration: 35 }),
            withTiming(-a, { duration: 50 }),
            withTiming(a * 0.5, { duration: 45 }),
            withTiming(0, { duration: 40 }),
          ),
        );
      }
    },
    [onChange, reduceMotion, shakeX, value],
  );
  // A drag along the bars picks the level under the thumb; a tap is left to the bar itself. Touch positions are
  // page coordinates, so the row's own page position is measured when a drag starts (it moves as the screen scrolls).
  const [rowLeft, setRowLeft] = useState(0);
  const slide = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const row = e.currentTarget as unknown as Measurable | null;
          row?.measure?.((_x, _y, _w, _h, pageX) => setRowLeft(pageX));
        },
        onPanResponderMove: (e) => choose(levelAt(e.nativeEvent.pageX - rowLeft, width)),
      }),
    [choose, rowLeft, width],
  );

  return (
    <View style={{ gap: spacing.sm }}>
      {variant === 'set' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="text2">
            Effort
          </Text>
          <Text variant="caption" color={value === null ? 'text2' : 'text'} style={{ fontFamily: fonts.semibold }}>
            {value === null ? 'Not set' : `${value} · ${setEffortCaption(value)}`}
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, minHeight: 52 }}>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 48,
              lineHeight: 52,
              color: value === null ? colors.text2 : scale[value - 1],
            }}
            numeric>
            {value === null ? '–' : String(value)}
          </Text>
          <View style={{ flexShrink: 1 }}>
            <Text variant="headline">{value === null ? 'Slide or tap' : CLASS_EFFORT[value].label}</Text>
            <Text variant="callout" color="text2">
              {value === null ? 'From easy to all out' : CLASS_EFFORT[value].description}
            </Text>
          </View>
        </View>
      )}
      <Animated.View
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          (e.currentTarget as unknown as Measurable | null)?.measure?.((_x, _y, _w, _h, pageX) => setRowLeft(pageX));
        }}
        {...slide.panHandlers}
        style={[{ flexDirection: 'row', gap: 4, alignItems: 'flex-end' }, shaking]}>
        {LEVELS.map((e) => {
          const selected = value === e;
          // Bars up to the chosen level fill with their colour on the green-to-red scale.
          const filled = value !== null && e <= value;
          return (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityLabel={name(e)}
              accessibilityState={{ selected }}
              accessibilityHint={selected ? 'Hold to clear' : undefined}
              onPress={() => choose(e)}
              onLongPress={() => onChange(null)}
              hitSlop={{ top: 6, bottom: 6 }}
              style={{
                flex: 1,
                height: variant === 'set' ? 36 : 10 + e * 4,
                minHeight: variant === 'set' ? 36 : undefined,
                borderRadius: variant === 'set' ? radii.control - 4 : 6,
                backgroundColor: filled ? scale[e - 1] : variant === 'set' ? colors.well : colors.track,
                opacity: filled && !selected ? 0.55 : 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {variant === 'set' ? (
                <Text
                  variant="caption"
                  style={{
                    fontFamily: selected ? fonts.bold : fonts.semibold,
                    color: filled ? colors.onEffortScale : colors.text2,
                  }}>
                  {String(e)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </Animated.View>
      {variant === 'class' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="micro" color="text2">
            Easy
          </Text>
          <Text variant="micro" color="text2">
            All out
          </Text>
        </View>
      ) : null}
    </View>
  );
}
