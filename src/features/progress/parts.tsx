import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { Sparkline } from '@/components/charts/Sparkline';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { effortScales, fonts, spacing, type ThemeName } from '@/theme/tokens';

/** The effort scale's colour for a 1–10 value (rounded), green to red. */
export function effortColor(theme: ThemeName, effort: number): string {
  const scale = effortScales[theme];
  return scale[Math.min(10, Math.max(1, Math.round(effort))) - 1];
}

export const fmt = (n: number, dp = 1) => (Math.round(n * 10 ** dp) / 10 ** dp).toLocaleString('en-GB');

/** A chart with its title, an optional note on the right, a one-line "what this shows", and an optional takeaway. */
export function ChartCard({
  title,
  note,
  caption,
  takeaway,
  takeawayColor,
  children,
}: {
  title: string;
  note?: string;
  caption: string;
  takeaway?: string | null;
  takeawayColor?: string;
  children: ReactNode;
}) {
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm }}>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        {note ? (
          <Text variant="caption" color="text2">
            {note}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" color="text2">
        {caption}
      </Text>
      {takeaway ? (
        <Text variant="callout" style={takeawayColor ? { color: takeawayColor } : undefined}>
          {takeaway}
        </Text>
      ) : null}
      {children}
    </Card>
  );
}

/** A headline number with its label and a small comparison line. */
export function StatTile({
  value,
  label,
  detail,
  color,
  detailColor,
}: {
  value: string;
  label: string;
  detail?: string;
  color?: string;
  detailColor?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: colors.card, borderRadius: 16, padding: spacing.md, gap: 2 }}>
      <Text variant="title" numeric style={color ? { color } : undefined}>
        {value}
      </Text>
      <Text variant="caption" color="text2">
        {label}
      </Text>
      {detail ? (
        <Text variant="caption" color="text2" style={detailColor ? { color: detailColor } : undefined}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** A lift in a list: name, a line about it, and its trend; opens the lift's page. */
export function LiftRow({
  name,
  detail,
  trend,
  trendColor,
  onPress,
  first,
}: {
  name: string;
  detail: string;
  trend: (number | null)[];
  trendColor: string;
  onPress: () => void;
  first: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${detail}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.sep,
        backgroundColor: pressed ? colors.well : 'transparent',
      })}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.semibold }}>{name}</Text>
        <Text variant="caption" color="text2" numeric>
          {detail}
        </Text>
      </View>
      <Sparkline values={trend} color={trendColor} />
    </Pressable>
  );
}

/** One chip per set with its effort (1–10) in the effort colour; unrated sets show a dash. */
export function EffortChips({ efforts }: { efforts: (number | null)[] }) {
  const { colors, name: theme } = useTheme();
  if (!efforts.some((e) => e !== null)) return null;
  return (
    <View
      accessible
      accessibilityLabel={`Effort by set: ${efforts.map((e) => (e === null ? 'not rated' : e)).join(', ')}`}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {efforts.map((e, i) => (
        <View
          key={i}
          style={{
            minWidth: 26,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: e === null ? colors.well : effortColor(theme, e),
          }}>
          <Text variant="caption" style={{ fontFamily: fonts.semibold, color: e === null ? colors.text2 : colors.onEffortScale }}>
            {e === null ? '–' : String(e)}
          </Text>
        </View>
      ))}
    </View>
  );
}
