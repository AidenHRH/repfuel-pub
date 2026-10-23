import { View } from 'react-native';

import type { Palette } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { Text } from './Text';

/** A large number with a quiet label underneath, e.g. a product's calories for the chosen amount. */
export function BigNumber({
  value,
  unit,
  label,
  color = 'text',
}: {
  value: string;
  unit?: string;
  label: string;
  color?: keyof Palette;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value}${unit ? ` ${unit}` : ''}`}
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: radii.card - 2,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm + 2,
        gap: 2,
      }}>
      <Text
        numeric
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: colors[color] }}>
        {value}
      </Text>
      <Text variant="caption" color="text2" numberOfLines={1}>
        {unit ? `${label} ${unit}` : label}
      </Text>
    </View>
  );
}
