import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp01(progress: number): number {
  if (!Number.isFinite(progress) || progress < 0) return 0;
  return Math.min(progress, 1);
}

/** Stroke offset that shows `progress` (clamped to 0–1) of a ring of radius `r`. */
export function ringDashOffset(progress: number, r: number): number {
  return 2 * Math.PI * r * (1 - clamp01(progress));
}

type RingSpec = { progress: number; color: string };

function Ring({ r, center, stroke, spec, track }: { r: number; center: number; stroke: number; spec: RingSpec; track: string }) {
  const offset = useSharedValue(ringDashOffset(0, r));

  useEffect(() => {
    offset.value = withTiming(ringDashOffset(spec.progress, r), {
      duration: motion.ring,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
    });
  }, [offset, r, spec.progress]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <>
      <Circle cx={center} cy={center} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={spec.color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${2 * Math.PI * r} ${2 * Math.PI * r}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </>
  );
}

type Props = {
  outer: RingSpec;
  inner: RingSpec;
  size?: number;
  stroke?: number;
  accessibilityLabel: string;
};

/** Two concentric progress rings, Apple Activity style. */
export function ProgressRing({ outer, inner, size = 124, stroke = 11, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const center = size / 2;
  const outerR = center - stroke / 2 - 2.5;
  const innerR = outerR - stroke - 4;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Ring r={outerR} center={center} stroke={stroke} spec={outer} track={colors.track} />
        <Ring r={innerR} center={center} stroke={stroke} spec={inner} track={colors.track} />
      </Svg>
    </View>
  );
}
