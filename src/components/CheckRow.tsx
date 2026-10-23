import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';

import { Text } from './Text';

/** A row with a round tick box, for checklists (shopping, meal prep). Ticked rows are struck through. */
export function CheckRow({
  title,
  detail,
  trailing,
  checked,
  onToggle,
  accessibilityLabel,
  first,
}: {
  title: string;
  detail?: ReactNode;
  trailing?: ReactNode;
  checked: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
  /** No separator above the first row of a group. */
  first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 52,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.sep,
        backgroundColor: pressed ? colors.well : 'transparent',
      })}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: checked ? colors.pro : colors.text2,
          backgroundColor: checked ? colors.pro : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked ? (
          <Text variant="micro" color="onAccent" style={{ fontFamily: fonts.bold }}>
            ✓
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontFamily: fonts.medium, textDecorationLine: checked ? 'line-through' : 'none' }}
          color={checked ? 'text2' : 'text'}>
          {title}
        </Text>
        {typeof detail === 'string' ? (
          <Text variant="caption" color="text2">
            {detail}
          </Text>
        ) : (
          detail
        )}
      </View>
      {trailing}
    </Pressable>
  );
}
