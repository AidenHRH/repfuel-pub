import { Pressable, View } from 'react-native';

import { PrBadge } from '@/components/PrBadge';
import { Text } from '@/components/Text';
import { durationLabel, effortLabel } from '@/domain/classes';
import { localTimeLabel } from '@/domain/dates';
import { effortLine, liftSummary, setsLabel } from '@/domain/lifts';
import type { FeedItem } from '@/domain/training';
import { effortColor } from '@/features/progress/parts';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';

/** The 10-step effort strip for a class: filled up to the effort, in the effort colour. */
export function EffortStrip({ effort }: { effort: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 10 }, (_, i) => (
        <View
          key={i}
          style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: i < effort ? colors.effort : colors.track }}
        />
      ))}
    </View>
  );
}

/** One session in the Workouts feed: a lift with its sets (and PR), or a class with how hard it was. */
export function FeedCard({
  item,
  day,
  onPress,
  onLongPress,
  first,
}: {
  item: FeedItem;
  day: string;
  onPress: () => void;
  onLongPress: () => void;
  first: boolean;
}) {
  const { colors, name: theme } = useTheme();
  const effort = item.kind === 'lift' ? effortLine(item.lift.sets) : null;
  const name = item.kind === 'lift' ? item.lift.exerciseName : item.session.className;
  const summary =
    item.kind === 'lift'
      ? [liftSummary(item.lift.sets), effort?.text, effort?.hint].filter(Boolean).join(', ')
      : [durationLabel(item.session.durationMin), item.session.effort ? `effort ${item.session.effort} of 10` : null]
          .filter(Boolean)
          .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${name}, ${day.toLowerCase()}, ${summary}`}
      accessibilityHint="Hold to delete"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
        gap: spacing.xs + 2,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.sep,
        backgroundColor: pressed ? colors.well : 'transparent',
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}>
          <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Text>
          {item.kind === 'lift' && item.isPr ? <PrBadge /> : null}
        </View>
        <Text variant="caption" color="text2" numeric>
          {item.kind === 'lift' ? localTimeLabel(item.lift.at) : durationLabel(item.session.durationMin)}
        </Text>
      </View>
      {item.kind === 'lift' ? (
        <>
          <Text variant="callout" color="text2" numeric>
            {setsLabel(item.lift.sets)}
          </Text>
          {effort ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <View
                style={{ flexDirection: 'row', gap: 3 }}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                {item.lift.sets.map((s, i) => (
                  <View
                    key={i}
                    style={{
                      width: 22,
                      height: 8,
                      borderRadius: 3,
                      backgroundColor: s.effort == null ? colors.track : effortColor(theme, s.effort),
                    }}
                  />
                ))}
              </View>
              <Text variant="caption" numeric style={{ fontFamily: fonts.semibold, color: colors.text2 }}>
                {effort.text}
              </Text>
              {effort.hint ? (
                <Text variant="caption" style={{ color: colors.up }}>
                  {effort.hint}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {item.session.effort ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <EffortStrip effort={item.session.effort} />
              <Text variant="callout" style={{ color: colors.effort, fontFamily: fonts.semibold }}>
                {`${item.session.effort}/10 · ${effortLabel(item.session.effort)}`}
              </Text>
            </View>
          ) : null}
          {item.session.notes ? (
            <Text variant="callout" color="text2" numberOfLines={2}>
              {`“${item.session.notes}”`}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
