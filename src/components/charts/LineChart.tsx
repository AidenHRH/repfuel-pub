import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { niceBounds, plot } from '@/domain/chartScale';
import { useTheme } from '@/theme/ThemeProvider';

const AXIS = 28;
const X_LABELS = 16;

type Props = {
  values: (number | null)[];
  /** Spoken summary of the whole chart. */
  accessibilityLabel: string;
  color: string;
  /** A colour per point (e.g. by effort); points without one aren't dotted. */
  dotColors?: (string | null)[];
  bounds?: { min: number; max: number };
  boundsOptions?: Parameters<typeof niceBounds>[1];
  xTicks?: { i: number; label: string }[];
  yFormat?: (v: number) => string;
  height?: number;
};

/** A line through the known values (gaps are skipped), with three gridlines and their values on the right. */
export function LineChart({
  values,
  accessibilityLabel,
  color,
  dotColors,
  bounds,
  boundsOptions,
  xTicks = [],
  yFormat = (v) => String(Math.round(v * 10) / 10),
  height = 150,
}: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(300);
  const b = bounds ?? niceBounds(values, boundsOptions);
  const plotW = Math.max(width - AXIS, 10);
  const pad = 6;
  const pts = plot(values, plotW - pad * 2, height - pad * 2, b).map((p) => ({ ...p, x: p.x + pad, y: p.y + pad }));
  const n = values.length;
  const xAt = (i: number) => pad + (n === 1 ? (plotW - pad * 2) / 2 : (i / (n - 1)) * (plotW - pad * 2));
  const grid = [b.max, (b.max + b.min) / 2, b.min];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Svg width={width} height={height + X_LABELS}>
        {grid.map((g, k) => {
          const y = pad + (k / 2) * (height - pad * 2);
          return <Line key={`g${k}`} x1={0} x2={plotW} y1={y} y2={y} stroke={colors.well} strokeWidth={1} />;
        })}
        {grid.map((g, k) => (
          <SvgText
            key={`l${k}`}
            x={width}
            y={pad + (k / 2) * (height - pad * 2) + 4}
            fill={colors.text2}
            fontSize={10}
            textAnchor="end">
            {yFormat(g)}
          </SvgText>
        ))}
        {pts.length > 1 ? (
          <Polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {pts.map((p, k) => {
          const dot = dotColors?.[p.i] ?? (k === pts.length - 1 ? color : null);
          return dot ? (
            <Circle
              key={`d${p.i}`}
              cx={p.x}
              cy={p.y}
              r={k === pts.length - 1 ? 5.5 : 4.5}
              fill={dot}
              stroke={colors.card}
              strokeWidth={1.5}
            />
          ) : null;
        })}
        {xTicks.map((t) => (
          <SvgText key={`x${t.i}`} x={Math.min(xAt(t.i), plotW - 18)} y={height + X_LABELS - 3} fill={colors.text2} fontSize={10}>
            {t.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
