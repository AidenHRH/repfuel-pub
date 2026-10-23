import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const X_LABELS = 16;

type Props = {
  values: number[];
  accessibilityLabel: string;
  color: string;
  /** Bars to draw paler (e.g. a much lighter week). */
  faded?: boolean[];
  /** A colour per bar, overriding `color`. */
  barColors?: (string | null)[];
  xTicks?: { i: number; label: string }[];
  height?: number;
};

/** Vertical bars from zero; a zero value draws nothing. */
export function BarChart({ values, accessibilityLabel, color, faded, barColors, xTicks = [], height = 120 }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(300);
  const max = Math.max(...values, 0) || 1;
  const slot = width / Math.max(values.length, 1);
  const barW = Math.max(Math.min(slot * 0.7, 28), 2);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Svg width={width} height={height + X_LABELS}>
        {values.map((v, i) => {
          if (v <= 0) return null;
          const h = Math.max((v / max) * height, 2);
          return (
            <Rect
              key={i}
              x={i * slot + (slot - barW) / 2}
              y={height - h}
              width={barW}
              height={h}
              rx={Math.min(4, barW / 2)}
              fill={barColors?.[i] ?? color}
              opacity={faded?.[i] ? 0.4 : 1}
            />
          );
        })}
        {xTicks.map((t) => (
          <SvgText
            key={`x${t.i}`}
            x={Math.min(t.i * slot, width - 22)}
            y={height + X_LABELS - 3}
            fill={colors.text2}
            fontSize={10}>
            {t.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
