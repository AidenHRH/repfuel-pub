import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { SHOPS } from '@/domain/shops';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

type Props = {
  value: string | null;
  onChange: (shop: string | null) => void;
  /** Shown as a Skip pill when the question is being asked (it's never required). */
  onSkip?: () => void;
};

/** "Where's this from?": one tap on a shop, tap it again to clear. Optional everywhere. */
export function ShopPicker({ value, onChange, onSkip }: Props) {
  const { colors } = useTheme();
  const pill = (label: string, selected: boolean, onPress: () => void, a11y = label) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radii.pill,
        backgroundColor: selected ? colors.accent : colors.well,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text variant="callout" style={{ fontFamily: fonts.semibold, color: selected ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="overline" color="text2" style={{ paddingHorizontal: spacing.xs }}>
        Where’s this from?
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {SHOPS.map((shop) => pill(shop, value === shop, () => onChange(value === shop ? null : shop)))}
        {onSkip ? pill('Skip', false, onSkip, 'Skip the shop') : null}
      </ScrollView>
    </View>
  );
}
