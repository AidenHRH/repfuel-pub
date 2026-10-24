import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, spacing } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  title?: string;
  /** Replaces the large title row (Summary's "Today ▾"). */
  header?: ReactNode;
  /** Small uppercase line above the title, e.g. today's date. */
  overline?: string;
  /** A quiet line under the title, e.g. the day's motivation. */
  subtitle?: string;
  /** Element shown to the right of the title, e.g. a round icon button. */
  accessory?: ReactNode;
  /** Extra space at the end so content can scroll clear of a floating button. */
  bottomInset?: number;
  children: ReactNode;
};

export function Screen({ title, header, overline, subtitle, accessory, bottomInset = 0, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.xl,
        paddingHorizontal: layout.gutter,
        paddingBottom: spacing.section * 2 + bottomInset,
        gap: spacing.section,
      }}
      showsVerticalScrollIndicator={false}>
      {header ?? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            {overline ? (
              <Text variant="overline" color="text2">
                {overline}
              </Text>
            ) : null}
            <Text variant="largeTitle" accessibilityRole="header">
              {title}
            </Text>
          </View>
          {accessory}
        </View>
      )}
      {subtitle ? (
        <Text variant="callout" color="text2" style={{ marginTop: -spacing.section + spacing.sm }}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </ScrollView>
  );
}
