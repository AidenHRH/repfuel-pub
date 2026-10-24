import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { getExercise } from '@/database/repositories/exerciseRepository';
import { allLiftSets } from '@/database/repositories/progressRepository';
import { monthTicks } from '@/domain/chartScale';
import { MUSCLE_GROUP_LABELS, type Exercise } from '@/domain/exercises';
import { dayLabel, setsLabel } from '@/domain/lifts';
import { liftSessions, prWorkoutIds, sameWeightEffort, weekOf, type ProgressSet } from '@/domain/progressStats';
import { exerciseRecords } from '@/domain/records';
import { ChartCard, EffortChips, effortColor, fmt } from '@/features/progress/parts';
import { RecordsCard } from '@/features/progress/RecordsCard';
import { workoutEvents } from '@/features/workouts/events';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

type Metric = 'e1rm' | 'heaviest' | 'volume' | 'effort';
const METRICS: { value: Metric; label: string }[] = [
  { value: 'e1rm', label: '1RM' },
  { value: 'heaviest', label: 'Heaviest' },
  { value: 'volume', label: 'Volume' },
  { value: 'effort', label: 'Effort' },
];
const CAPTIONS: Record<Metric, string> = {
  e1rm: 'Estimated 1-rep max each session. Dots are coloured by how hard the session felt.',
  heaviest: 'The heaviest weight you lifted each session.',
  volume: 'Weight × reps each session: how much work you did.',
  effort: 'How hard each session felt on average, 1–10.',
};

/** The last sessions shown on the charts. */
const SHOWN = 24;

/** One lift's progress: its chart (1RM, heaviest, volume or effort), same weight getting easier, records, sessions. */
export default function LiftProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const router = useRouter();
  const { colors, name: theme } = useTheme();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<ProgressSet[] | null>(null);
  const [metric, setMetric] = useState<Metric>('e1rm');
  const [version, setVersion] = useState(0);

  useEffect(() => workoutEvents.subscribe((e) => e.type === 'changed' && setVersion((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getExercise(db, id), allLiftSets(db)]).then(
      ([e, s]) => {
        if (cancelled) return;
        setExercise(e);
        setSets(s);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db, id, version]);

  if (!exercise || !sets)
    return (
      <ModalScreen title="Progress" onClose={() => router.back()}>
        {null}
      </ModalScreen>
    );

  const own = sets.filter((s) => s.exerciseId === id);
  const sessions = liftSessions(sets, id);
  const shown = sessions.slice(-SHOWN);
  const prs = prWorkoutIds(sets);
  const hasEstimate = shown.some((s) => s.e1rm !== null);
  const value = (s: (typeof shown)[number]): number | null =>
    metric === 'e1rm' ? s.e1rm : metric === 'heaviest' ? s.heaviestKg : metric === 'volume' ? s.volumeKg : s.effort;
  const values = shown.map(value);
  const known = values.filter((v): v is number => v !== null);
  const unit = metric === 'effort' ? '' : ' kg';
  const diff = known.length >= 2 ? known.at(-1)! - known[0] : null;
  const ticks = monthTicks(shown.map((s) => weekOf(s.at)));
  const same = sameWeightEffort(sessions);
  const records = exerciseRecords(own);
  const goodDiff = diff !== null && (metric === 'effort' ? diff < 0 : diff > 0);

  return (
    <ModalScreen title={exercise.name} closeLabel="Done" onClose={() => router.back()}>
      <Text variant="callout" color="text2">
        {`${MUSCLE_GROUP_LABELS[exercise.muscleGroup]} · ${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
      </Text>

      {sessions.length === 0 ? (
        <Text color="text2">Log this lift and its progress shows here.</Text>
      ) : (
        <>
          <Segmented
            accessibilityLabel="Chart"
            value={metric}
            onChange={setMetric}
            options={hasEstimate ? METRICS : METRICS.filter((m) => m.value !== 'e1rm' && m.value !== 'heaviest')}
          />
          <ChartCard title={METRICS.find((m) => m.value === metric)!.label} caption={CAPTIONS[metric]}>
            {known.length ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                  <Text variant="title" numeric>{`${fmt(known.at(-1)!, metric === 'effort' ? 1 : 0)}${unit}`}</Text>
                  {diff !== null && Math.abs(diff) >= 0.05 ? (
                    <Text variant="callout" numeric style={{ color: goodDiff ? colors.up : colors.kcal }}>
                      {`${diff > 0 ? '+' : ''}${fmt(diff, metric === 'effort' ? 1 : 0)}${unit}`}
                    </Text>
                  ) : null}
                </View>
                {metric === 'volume' ? (
                  <BarChart
                    values={values.map((v) => v ?? 0)}
                    color={colors.accent}
                    xTicks={ticks}
                    accessibilityLabel={`Volume over the last ${shown.length} sessions`}
                  />
                ) : (
                  <LineChart
                    values={values}
                    color={metric === 'effort' ? colors.effort : colors.accent}
                    dotColors={
                      metric === 'effort'
                        ? undefined
                        : shown.map((s) => (s.effort === null ? null : effortColor(theme, s.effort)))
                    }
                    boundsOptions={metric === 'effort' ? { floor: 1, ceil: 10, minStep: 1 } : undefined}
                    xTicks={ticks}
                    accessibilityLabel={`${METRICS.find((m) => m.value === metric)!.label} over the last ${shown.length} sessions: ${
                      known.length > 1 ? `from ${fmt(known[0])} to ${fmt(known.at(-1)!)}` : fmt(known[0])
                    }${unit}`}
                  />
                )}
              </>
            ) : (
              <Text color="text2">
                {metric === 'effort' ? 'Rate your sets with the effort slider to see this.' : 'Nothing to show yet.'}
              </Text>
            )}
          </ChartCard>

          {same ? (
            <ChartCard
              title="Same weight, getting easier?"
              caption={`Effort on your ${fmt(same.weightKg)} kg × ${same.reps} sets. Lower bars mean you’re getting stronger at this weight.`}>
              <BarChart
                values={same.points.map((p) => p.effort)}
                color={colors.effort}
                barColors={same.points.map((p) => effortColor(theme, p.effort))}
                height={100}
                accessibilityLabel={`Effort on ${same.weightKg} kg for ${same.reps}: from ${same.points[0].effort} to ${same.points.at(-1)!.effort}`}
              />
            </ChartCard>
          ) : null}

          <RecordsCard exercise={exercise} records={records} lastAt={sessions.at(-1)!.at} />

          <View style={{ gap: spacing.sm }}>
            <Text variant="title" accessibilityRole="header">
              Sessions
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
              {[...sessions]
                .reverse()
                .slice(0, 12)
                .map((s, i) => (
                  <View
                    key={s.workoutId}
                    accessible
                    accessibilityLabel={`${dayLabel(s.at)}: ${setsLabel(s.sets)}${prs.has(s.workoutId) ? ', a PR' : ''}`}
                    style={{ padding: spacing.lg, gap: spacing.xs, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.sep }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: fonts.semibold }}>{dayLabel(s.at)}</Text>
                      {prs.has(s.workoutId) ? (
                        <Text variant="caption" style={{ color: colors.pr }}>
                          PR
                        </Text>
                      ) : null}
                    </View>
                    <Text variant="callout" color="text2" numeric>
                      {setsLabel(s.sets)}
                    </Text>
                    <EffortChips efforts={s.sets.map((x) => x.effort)} />
                  </View>
                ))}
            </View>
          </View>
        </>
      )}
    </ModalScreen>
  );
}
