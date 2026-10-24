import Svg, { Circle, Path } from 'react-native-svg';

import type { DayStage } from '@/domain/dayStatus';
import { MAIN_MEALS } from '@/domain/dayStatus';
import { useTheme } from '@/theme/ThemeProvider';

/** A day's dot: dashed grey (nothing), a part-filled ring (under way), an amber ring (goals missed), solid with a tick (hit). */
export function DayDot({ stage, mealsDone, size = 30 }: { stage: DayStage; mealsDone: number; size?: number }) {
  const { colors } = useTheme();
  const r = size / 2 - 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  if (stage === 'hit')
    return (
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r + 1} fill={colors.accent} />
        <Path
          d={`M${c - r * 0.42} ${c + r * 0.02} L${c - r * 0.1} ${c + r * 0.34} L${c + r * 0.45} ${c - r * 0.3}`}
          stroke={colors.onAccent}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  if (stage === 'missed')
    return (
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={colors.kcal} strokeWidth={3} fill="none" />
      </Svg>
    );
  if (stage === 'partial') {
    const share = Math.max(mealsDone, 0.5) / MAIN_MEALS.length;
    return (
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={colors.track} strokeWidth={3} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={colors.accent}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * share} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={colors.text2}
        strokeOpacity={0.55}
        strokeWidth={1.5}
        strokeDasharray="3 3"
        fill="none"
      />
    </Svg>
  );
}

export const STAGE_WORDS: Record<DayStage, string> = {
  empty: 'nothing logged',
  partial: 'partly logged',
  missed: 'fully logged, goals missed',
  hit: 'goals hit',
};
