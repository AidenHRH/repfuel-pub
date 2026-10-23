import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

import { ChevronIcon } from './icons';
import { Text } from './Text';

/** An inset grouped list (Apple Settings style) with hairline separators between rows. */
export function ListGroup({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <Text variant="overline" color="text2" style={{ paddingHorizontal: spacing.xs }}>
          {title}
        </Text>
      ) : null}
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden', borderCurve: 'continuous' }}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: colors.sep, marginLeft: spacing.lg }} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function ListRow({
  label,
  value,
  children,
  onPress,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
  /** Makes the whole row a button (with a chevron), e.g. to edit the value. */
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const content = (
    <View
      style={{
        minHeight: 50,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}>
      <Text>{label}</Text>
      {value !== undefined || onPress ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {value !== undefined ? (
            <Text color="text2" numeric>
              {value}
            </Text>
          ) : null}
          {onPress ? <ChevronIcon color={colors.text2} size={16} /> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value !== undefined ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.well : 'transparent' })}>
      {content}
    </Pressable>
  );
}
