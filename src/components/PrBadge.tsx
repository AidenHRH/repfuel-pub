import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

import { Text } from './Text';

/** The small gold "PR" tag beside a lift that set a personal record. */
export function PrBadge() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Personal record"
      style={{ backgroundColor: colors.pr, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
      <Text variant="micro" style={{ color: colors.onPr, fontFamily: fonts.bold }}>
        PR
      </Text>
    </View>
  );
}
