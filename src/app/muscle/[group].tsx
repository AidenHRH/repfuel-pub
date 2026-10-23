import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { allLiftSets } from '@/database/repositories/progressRepository';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '@/domain/exercises';
import { dayLabel } from '@/domain/lifts';
import { muscleProgress, RANGE_LABELS, weekStarts, type ProgressSet, type Range } from '@/domain/progressStats';
import { ticksFor } from '@/features/progress/OverviewView';
import { ChartCard, effortColor, fmt, LiftRow, StatTile } from '@/features/progress/parts';
import { workoutEvents } from '@/features/workouts/events';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

const isMuscle = (g: string | undefined): g is MuscleGroup => !!g && g in MUSCLE_GROUP_LABELS;

/** A muscle's progress: hard sets, effort and PRs; strength over time; current PRs; its lifts and workouts. */
export default function MuscleScreen() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const db = useDb();
  const router = useRouter();
  const { colors, name: theme } = useTheme();
  const [sets, setSets] = useState<ProgressSet[] | null>(null);
  const [range, setRange] = useState<Range>('12w');
  const [version, setVersion] = useState(0);

  useEffect(() => workoutEvents.subscribe((e) => e.type === 'changed' && setVersion((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    allLiftSets(db).then(
      (s) => !cancelled && setSets(s),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  const muscle = isMuscle(group) ? group : 'other';
  const label = MUSCLE_GROUP_LABELS[muscle];
  if (!sets)
    return (
      <ModalScreen title={label} onClose={() => router.back()}>
        {null}
      </ModalScreen>
    );

  const m = muscleProgress(sets, muscle, range);
  const weeks = weekStarts(range);
  const ticks = ticksFor(weeks);
  const strength = m.strength.filter((v): v is number => v !== null);
  const gain = strength.at(-1) ?? null;

  return (
    <ModalScreen title={label} closeLabel="Done" onClose={() => router.back()}>
      <Text variant="callout" color="text2">
        {`${m.lifts.length} lift${m.lifts.length === 1 ? '' : 's'} · ${m.workouts.length} workout${m.workouts.length === 1 ? '' : 's'} in the last ${RANGE_LABELS[range]}`}
      </Text>
      <Segmented
        accessibilityLabel="Time range"
        value={range}
        onChange={setRange}
        options={(['4w', '12w', '1y'] as Range[]).map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
      />

      {m.workouts.length === 0 ? (
        <Text color="text2">{`No ${label.toLowerCase()} workouts in this time. Try a longer range.`}</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <StatTile value={fmt(m.hardSetsPerWeek)} label="Hard sets a week" />
            <StatTile
              value={m.avgEffort === null ? '—' : fmt(m.avgEffort)}
              label="Average effort"
              color={m.avgEffort === null ? undefined : effortColor(theme, m.avgEffort)}
            />
            <StatTile value={String(m.prs)} label="PRs" color={colors.pr} />
          </View>

          {strength.length >= 2 ? (
            <ChartCard
              title={`${label} strength`}
              note={gain === null ? undefined : `${gain > 0 ? '+' : ''}${fmt(gain)}%`}
              caption={`Your ${label.toLowerCase()} lifts’ 1-rep max estimates, against where each started in this time.`}>
              <LineChart
                values={m.strength}
                color={colors.pro}
                xTicks={ticks}
                yFormat={(v) => `${Math.round(v)}%`}
                accessibilityLabel={`${label} strength over ${RANGE_LABELS[range]}: ${gain === null ? 'no change' : `${gain > 0 ? 'up' : 'down'} ${fmt(Math.abs(gain))}%`}`}
              />
            </ChartCard>
          ) : null}

          <ChartCard
            title="Sets and effort"
            caption={`Bars: hard ${label.toLowerCase()} sets each week. Line: how hard they felt on average.`}>
            <BarChart
              values={m.weeklySets}
              color={colors.pro}
              xTicks={ticks}
              height={90}
              accessibilityLabel={`Hard ${label.toLowerCase()} sets each week`}
            />
            {m.weeklyEffort.some((e) => e !== null) ? (
              <LineChart
                values={m.weeklyEffort}
                color={colors.effort}
                boundsOptions={{ floor: 1, ceil: 10, minStep: 1 }}
                height={70}
                accessibilityLabel={`Average ${label.toLowerCase()} effort each week`}
              />
            ) : null}
          </ChartCard>

          {m.currentPrs.length ? (
            <ChartCard title="Current PRs" caption="Your heaviest set on each lift.">
              <View style={{ gap: spacing.sm }}>
                {m.currentPrs.map((p) => (
                  <View key={p.exerciseId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                    <Text style={{ flexShrink: 1 }}>{p.name}</Text>
                    <Text numeric style={{ color: colors.pr, fontFamily: fonts.semibold }}>
                      {p.label}
                    </Text>
                  </View>
                ))}
              </View>
            </ChartCard>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Text variant="title" accessibilityRole="header">{`${label} lifts`}</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
              {m.lifts.map((l, i) => (
                <LiftRow
                  key={l.exerciseId}
                  first={i === 0}
                  name={l.name}
                  detail={
                    l.latest === null
                      ? 'No estimate (bodyweight or timed)'
                      : `1RM est. ${fmt(l.latest, 0)} kg${l.change ? ` · ${l.change > 0 ? '+' : ''}${fmt(l.change)} kg` : ''}`
                  }
                  trend={l.points}
                  trendColor={l.change !== null && l.change < 0 ? colors.kcal : colors.up}
                  onPress={() => router.push({ pathname: '/lift-progress/[id]', params: { id: l.exerciseId } })}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="title" accessibilityRole="header">{`${label} workouts`}</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
              {m.workouts.slice(0, 20).map((w, i) => (
                <View
                  key={w.day}
                  accessible
                  accessibilityLabel={`${dayLabel(`${w.day}T12:00:00`)}: ${w.lifts.join(', ')}${w.effort === null ? '' : `, effort ${w.effort}`}${w.prs ? `, ${w.prs} PR${w.prs === 1 ? '' : 's'}` : ''}`}
                  style={{ padding: spacing.lg, gap: 2, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.sep }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                    <Text style={{ fontFamily: fonts.semibold }}>{dayLabel(`${w.day}T12:00:00`)}</Text>
                    {w.effort !== null ? (
                      <Text variant="caption" numeric style={{ color: effortColor(theme, w.effort), fontFamily: fonts.semibold }}>
                        {`effort ${fmt(w.effort)}`}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="callout" color="text2">
                    {`${w.lifts.join(', ')}${w.prs ? ` · ${w.prs} PR${w.prs === 1 ? '' : 's'}` : ''}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </ModalScreen>
  );
}
