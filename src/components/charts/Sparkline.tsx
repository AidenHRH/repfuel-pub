import Svg, { Polyline } from 'react-native-svg';

import { niceBounds, plot } from '@/domain/chartScale';

/** A small trend line for a list row; decorative (the row says the numbers). */
export function Sparkline({
  values,
  color,
  width = 72,
  height = 28,
}: {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
}) {
  const pts = plot(values, width - 4, height - 4, niceBounds(values));
  if (pts.length < 2) return null;
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline
        points={pts.map((p) => `${p.x + 2},${p.y + 2}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
