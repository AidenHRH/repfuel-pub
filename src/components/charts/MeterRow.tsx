import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

/** A labelled horizontal bar: `value` of `max`, with its number at the end. */
export function MeterRow({ label, value, max, valueLabel }: { label: string; value: number; max: number; valueLabel: string }) {
  const { colors } = useTheme();
  const share = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${valueLabel}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text variant="callout" style={{ width: 84 }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 10, borderRadius: radii.pill, backgroundColor: colors.well, overflow: 'hidden' }}>
        <View style={{ width: `${share * 100}%`, height: 10, borderRadius: radii.pill, backgroundColor: colors.accent }} />
      </View>
      <Text variant="caption" color="text2" numeric style={{ width: 32, textAlign: 'right' }}>
        {valueLabel}
      </Text>
    </View>
  );
}
