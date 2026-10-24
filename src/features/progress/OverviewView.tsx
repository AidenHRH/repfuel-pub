import { router } from 'expo-router';
import { View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { MeterRow } from '@/components/charts/MeterRow';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { monthTicks } from '@/domain/chartScale';
import { MUSCLE_GROUP_LABELS } from '@/domain/exercises';
import {
  effortTakeaway,
  hardSetsPerMuscle,
  liftTrend,
  overview,
  RANGE_LABELS,
  weekStarts,
  weeklyEffort,
  weeklyTonnage,
  type ClassEffort,
  type ProgressSet,
  type Range,
} from '@/domain/progressStats';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

import { ChartCard, effortColor, fmt, LiftRow, StatTile } from './parts';

/** Month labels, every other one when there are many. */
export function ticksFor(weeks: string[]) {
  const ticks = monthTicks(weeks);
  return ticks.length > 6 ? ticks.filter((_, k) => k % 2 === 0) : ticks;
}

const change = (now: number, before: number, unit = '') => {
  const d = Math.round((now - before) * 10) / 10;
  return `${d > 0 ? '+' : ''}${fmt(d)}${unit}`;
};

/** Progress › Overview: headline numbers, effort, weight lifted, sets per muscle and the most trained lifts. */
export function OverviewView({
  sets,
  classes,
  range,
  onRange,
  now = new Date(),
}: {
  sets: ProgressSet[];
  classes: ClassEffort[];
  range: Range;
  onRange: (r: Range) => void;
  now?: Date;
}) {
  const { colors, name: theme } = useTheme();
  const weeks = weekStarts(range, now);
  const ticks = ticksFor(weeks);
  const o = overview(sets, classes, range, now);
  const effort = weeklyEffort([...sets, ...classes], weeks);
  const tonnes = weeklyTonnage(sets, weeks);
  const lifted = tonnes.filter((t) => t > 0).sort((a, b) => a - b);
  const median = lifted.length ? lifted[Math.floor(lifted.length / 2)] : 0;
  const takeaway = effortTakeaway(effort, tonnes);
  const muscles = hardSetsPerMuscle(sets, now);
  const start = Date.parse(`${weeks[0]}T00:00:00`);
  const recent = sets.filter((s) => Date.parse(s.at) >= start);
  const sessions = new Map<string, Set<string>>();
  for (const s of recent) sessions.set(s.exerciseId, (sessions.get(s.exerciseId) ?? new Set()).add(s.workoutId));
  const top = [...sessions.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5);
  const known = effort.filter((e): e is number => e !== null);
  const span = RANGE_LABELS[range].replace(/^1 /, '');

  return (
    <View style={{ gap: spacing.lg }}>
      <Segmented
        accessibilityLabel="Time range"
        value={range}
        onChange={onRange}
        options={(['4w', '12w', '1y'] as Range[]).map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <StatTile
          value={String(o.workouts)}
          label="Workouts"
          detail={`${change(o.workouts, o.workoutsBefore)} vs the ${span} before`}
          detailColor={o.workouts > o.workoutsBefore ? colors.up : undefined}
        />
        <StatTile
          value={`${fmt(o.tonnes)} t`}
          label="Weight lifted"
          detail={
            o.tonnesBefore > 0
              ? `${change(((o.tonnes - o.tonnesBefore) / o.tonnesBefore) * 100, 0, '%')} vs before`
              : 'weight × reps'
          }
          detailColor={o.tonnes > o.tonnesBefore && o.tonnesBefore > 0 ? colors.up : undefined}
        />
        <StatTile
          value={o.avgEffort === null ? '—' : fmt(o.avgEffort)}
          label="Average effort"
          detail="out of 10"
          color={o.avgEffort === null ? undefined : effortColor(theme, o.avgEffort)}
        />
        <StatTile value={String(o.newPrs)} label="New PRs" detail="lifts that set a record" color={colors.pr} />
      </View>

      <ChartCard
        title="Effort"
        note="weekly average"
        caption="How hard your sets and classes felt, 1–10. Lower at the same weights means you’re getting stronger."
        takeaway={takeaway}
        takeawayColor={takeaway?.startsWith('Down') ? colors.up : undefined}>
        {known.length ? (
          <LineChart
            values={effort}
            color={colors.effort}
            boundsOptions={{ floor: 1, ceil: 10, minStep: 1 }}
            xTicks={ticks}
            accessibilityLabel={`Weekly average effort over ${RANGE_LABELS[range]}: ${known.length > 1 ? `from ${known[0]} to ${known.at(-1)}` : `${known[0]}`}`}
          />
        ) : (
          <Text color="text2">Rate your sets with the effort slider and the trend shows here.</Text>
        )}
      </ChartCard>

      <ChartCard
        title="Weight lifted"
        note="tonnes a week"
        caption="Weight × reps, added up each week. Rising means more work done.">
        <BarChart
          values={tonnes}
          color={colors.accent}
          faded={tonnes.map((t) => t > 0 && t < median * 0.5)}
          xTicks={ticks}
          accessibilityLabel={`Tonnes lifted each week over ${RANGE_LABELS[range]}, ${fmt(o.tonnes)} in all`}
        />
        {tonnes.some((t) => t > 0 && t < median * 0.5) ? (
          <Text variant="caption" color="text2">
            Paler weeks were much lighter than usual (a deload or a few days off).
          </Text>
        ) : null}
      </ChartCard>

      {muscles.length ? (
        <ChartCard
          title="Sets per muscle"
          note="last 4 weeks"
          caption="Sets at effort 7 or more (or not rated), a week. Shows which muscles get the most work.">
          <View style={{ gap: spacing.sm }}>
            {muscles.map((m) => (
              <MeterRow
                key={m.muscle}
                label={MUSCLE_GROUP_LABELS[m.muscle]}
                value={m.perWeek}
                max={muscles[0].perWeek}
                valueLabel={fmt(m.perWeek)}
              />
            ))}
          </View>
        </ChartCard>
      ) : null}

      {top.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="title" accessibilityRole="header">
            Your lifts
          </Text>
          <Text variant="caption" color="text2">
            Each lift’s estimated 1-rep max over the period. Tap one for the full story.
          </Text>
          <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
            {top.map(([id, ws], i) => {
              const t = liftTrend(sets, id, weeks);
              const name = recent.find((s) => s.exerciseId === id)!.exerciseName;
              const detail =
                t.latest === null
                  ? `${ws.size} session${ws.size === 1 ? '' : 's'}`
                  : `1RM est. ${fmt(t.latest, 0)} kg${t.change ? ` · ${t.change > 0 ? '+' : ''}${fmt(t.change)} kg` : ''}`;
              return (
                <LiftRow
                  key={id}
                  first={i === 0}
                  name={name}
                  detail={detail}
                  trend={t.points}
                  trendColor={t.change !== null && t.change < 0 ? colors.kcal : colors.up}
                  onPress={() => router.push({ pathname: '/lift-progress/[id]', params: { id } })}
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
