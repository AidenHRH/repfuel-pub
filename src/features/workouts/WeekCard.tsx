import { View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { durationLabel } from '@/domain/classes';
import type { WeekSummary } from '@/domain/training';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';

function Stat({ value, label, a11y, color }: { value: string; label: string; a11y: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={a11y} style={{ flex: 1, gap: 2 }}>
      <Text numeric style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: color ?? colors.text }}>
        {value}
      </Text>
      <Text variant="caption" color="text2">
        {label}
      </Text>
    </View>
  );
}

/** This week at a glance: sessions, class time, PRs, and a Monday–Sunday strip (strength blue, classes orange). */
export function WeekCard({ week }: { week: WeekSummary }) {
  const { colors } = useTheme();
  const legend = (color: string, label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" color="text2">
        {label}
      </Text>
    </View>
  );
  return (
    <Card hero accessibilityLabel="This week" style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Stat value={String(week.sessions)} label="sessions" a11y={`${week.sessions} session${week.sessions === 1 ? '' : 's'}`} />
        <Stat
          value={week.classMinutes ? durationLabel(week.classMinutes) : '–'}
          label="in classes"
          a11y={`${week.classMinutes ? durationLabel(week.classMinutes) : 'No time'} of classes`}
        />
        <Stat
          value={String(week.prs)}
          label={week.prs === 1 ? 'PR' : 'PRs'}
          a11y={`${week.prs} PR${week.prs === 1 ? '' : 's'}`}
          color={week.prs ? colors.pr : undefined}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {week.days.map((d) => (
          <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View
              style={{
                alignSelf: 'stretch',
                height: 36,
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: colors.well,
                flexDirection: 'row',
              }}>
              {d.strength ? <View style={{ flex: 1, backgroundColor: colors.accent }} /> : null}
              {d.classes ? <View style={{ flex: 1, backgroundColor: colors.effort }} /> : null}
            </View>
            <Text
              variant="caption"
              color={d.isToday ? 'text' : 'text2'}
              style={{ fontFamily: d.isToday ? fonts.bold : fonts.medium }}>
              {d.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        {legend(colors.accent, 'Strength')}
        {legend(colors.effort, 'Class')}
      </View>
    </Card>
  );
}
