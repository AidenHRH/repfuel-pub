import { useEffect } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radii, spacing } from '@/theme/tokens';

import type { Rect } from './measure';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Room around the target, the window's corners, and the smallest window (so a tab icon still reads as a button).
const PAD = 6;
const CORNER = 16;
const MIN_SIZE = 56;

export type Spotlight = {
  /** "Tour" or "Tip", read first by screen readers. */
  kind: 'Tour' | 'Tip';
  rect: Rect;
  title: string;
  text: string;
  /** "3 of 8" on tour stops. */
  counter?: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
};

/** The window around a target, padded and never smaller than MIN_SIZE. */
function windowFor(rect: Rect) {
  const width = Math.max(rect.width + PAD * 2, MIN_SIZE);
  const height = Math.max(rect.height + PAD * 2, MIN_SIZE);
  return { x: rect.x + rect.width / 2 - width / 2, y: rect.y + rect.height / 2 - height / 2, width, height };
}

/**
 * Dims the whole screen except a rounded window over the target, with a note card above or below it. Sits in a
 * Modal so it covers every screen and is modal for screen readers; the window glides between targets (fades with
 * Reduce Motion). Tapping the window does the primary action.
 */
export function TourOverlay({ spot }: { spot: Spotlight | null }) {
  const { colors } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);

  const target = spot ? windowFor(spot.rect) : null;
  useEffect(() => {
    if (!target) return;
    const move = (v: typeof x, to: number) => (v.value = reduceMotion || w.value === 0 ? to : withTiming(to, { duration: 280 }));
    move(x, target.x);
    move(y, target.y);
    move(h, target.height);
    move(w, target.width);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- moves when the window does
  }, [target?.x, target?.y, target?.width, target?.height, reduceMotion]);

  const animatedProps = useAnimatedProps(() => {
    const r = Math.min(CORNER, w.value / 2, h.value / 2);
    const [l, t, rt, b] = [x.value, y.value, x.value + w.value, y.value + h.value];
    return {
      d:
        `M0 0H${W}V${H}H0Z ` +
        `M${l + r} ${t}H${rt - r}A${r} ${r} 0 0 1 ${rt} ${t + r}V${b - r}A${r} ${r} 0 0 1 ${rt - r} ${b}` +
        `H${l + r}A${r} ${r} 0 0 1 ${l} ${b - r}V${t + r}A${r} ${r} 0 0 1 ${l + r} ${t}Z`,
    };
  });

  if (!spot || !target) return null;
  const below = target.y + target.height / 2 < H / 2;
  const cardPlace = below ? { top: target.y + target.height + spacing.md } : { bottom: H - target.y + spacing.md };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={spot.secondary?.onPress ?? spot.primary.onPress}>
      <View style={{ flex: 1 }}>
        <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
          <AnimatedPath animatedProps={animatedProps} fill={colors.spotlight} fillRule="evenodd" />
        </Svg>
        {/* The window itself: tapping what's highlighted moves on, like Next. */}
        <Pressable
          onPress={spot.primary.onPress}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            left: target.x,
            top: target.y,
            width: target.width,
            height: target.height,
            borderRadius: CORNER,
          }}
        />
        <Animated.View
          key={`${spot.title}:${spot.counter ?? ''}`}
          entering={FadeIn.duration(reduceMotion ? 0 : 180)}
          accessibilityViewIsModal
          accessibilityLabel={spot.kind}
          style={{
            position: 'absolute',
            left: layout.gutter,
            right: layout.gutter,
            ...cardPlace,
            backgroundColor: colors.sheet,
            borderRadius: radii.card,
            padding: spacing.lg,
            gap: spacing.sm,
          }}>
          <Text variant="headline" accessibilityRole="header">
            {spot.title}
          </Text>
          <Text variant="callout" color="text2">
            {spot.text}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
            {spot.counter ? (
              <Text variant="caption" color="text2" numeric style={{ flex: 1 }}>
                {spot.counter}
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {spot.secondary ? <Button variant="plain" label={spot.secondary.label} onPress={spot.secondary.onPress} /> : null}
            <Button label={spot.primary.label} onPress={spot.primary.onPress} style={{ paddingHorizontal: spacing.lg }} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
