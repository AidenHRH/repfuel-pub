import { View } from 'react-native';

import { Text } from '@/components/Text';
import type { IngredientLine } from '@/domain/recipeView';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

/** An ingredient a step uses, highlighted with its amount ("Turkey mince 500 g"). */
export function IngredientChip({ line }: { line: IngredientLine }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Uses ${line.name}, ${line.amount}`}
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        backgroundColor: colors.prBg,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}>
      <Text variant="caption" style={{ color: colors.pr, fontFamily: fonts.semibold }}>
        {line.name.replace(/, (raw|dry|cooked|tinned|drained)( .*)?$/, '')}
      </Text>
      <Text variant="caption" numeric style={{ color: colors.pr }}>
        {line.amount}
      </Text>
    </View>
  );
}
