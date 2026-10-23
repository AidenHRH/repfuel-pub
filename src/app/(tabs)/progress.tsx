import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { TrophyIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { allRecords } from '@/database/repositories/liftRepository';
import { allLiftSets, classEfforts } from '@/database/repositories/progressRepository';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '@/domain/exercises';
import { liftTrend, weekStarts, type ClassEffort, type ProgressSet, type Range } from '@/domain/progressStats';
import { OverviewView } from '@/features/progress/OverviewView';
import { fmt, LiftRow } from '@/features/progress/parts';
import { RecordsCard, type RecordsRow } from '@/features/progress/RecordsCard';
import { workoutEvents } from '@/features/workouts/events';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

type View_ = 'overview' | 'lifts' | 'records';

const openLift = (id: string) => router.push({ pathname: '/lift-progress/[id]', params: { id } });
const openMuscle = (group: MuscleGroup) => router.push({ pathname: '/muscle/[group]', params: { group } });

export default function ProgressScreen() {
  const db = useDb();
  const { colors } = useTheme();
  const [sets, setSets] = useState<ProgressSet[] | null>(null);
  const [classes, setClasses] = useState<ClassEffort[]>([]);
  const [records, setRecords] = useState<RecordsRow[]>([]);
  const [view, setView] = useState<View_>('overview');
  const [range, setRange] = useState<Range>('12w');
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => workoutEvents.subscribe((e) => e.type === 'changed' && setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([allLiftSets(db), classEfforts(db), allRecords(db)]).then(
      ([s, c, r]) => {
        if (cancelled) return;
        setSets(s);
        setClasses(c);
        setRecords(r);
      },
      () => !cancelled && setSets([]),
    );
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  if (sets && sets.length === 0 && classes.length === 0) {
    return (
      <Screen title="Progress">
        <EmptyState
          icon={<TrophyIcon color={colors.pro} />}
          title="No workouts yet"
          message="Log a workout and your progress, effort and best sets show up here, worked out from everything you log."
        />
      </Screen>
    );
  }
  if (!sets) return <Screen title="Progress">{null}</Screen>;

  // Most recently trained first.
  const exercises = [...new Map([...sets].reverse().map((s) => [s.exerciseId, s])).values()];
  const muscles = [...new Set(sets.map((s) => s.muscleGroup))].sort(
    (a, b) => sets.filter((s) => s.muscleGroup === b).length - sets.filter((s) => s.muscleGroup === a).length,
  );
  const q = search.trim().toLowerCase();
  const foundMuscles = q ? muscles.filter((m) => MUSCLE_GROUP_LABELS[m].toLowerCase().includes(q)) : [];
  const foundLifts = q ? exercises.filter((e) => e.exerciseName.toLowerCase().includes(q)) : [];
  const weeks = weekStarts('12w');
  const liftDetail = (id: string) => {
    const t = liftTrend(sets, id, weeks);
    return {
      trend: t.points,
      detail:
        t.latest === null
          ? MUSCLE_GROUP_LABELS[exercises.find((e) => e.exerciseId === id)!.muscleGroup]
          : `1RM est. ${fmt(t.latest, 0)} kg`,
      down: t.change !== null && t.change < 0,
    };
  };

  return (
    <Screen title="Progress">
      <View style={{ gap: spacing.sm }}>
        <TextInput
          accessibilityLabel="Search a lift or muscle"
          placeholder="Search a lift or muscle"
          placeholderTextColor={colors.text2}
          value={search}
          onChangeText={setSearch}
          selectionColor={colors.pro}
          style={{
            backgroundColor: colors.card,
            borderRadius: radii.control,
            minHeight: 44,
            paddingHorizontal: spacing.md,
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: 16,
          }}
        />
        {/* While searching, the results list the matching muscles instead. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, display: q ? 'none' : 'flex' }}>
          {muscles.map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`${MUSCLE_GROUP_LABELS[m]} progress`}
              onPress={() => openMuscle(m)}
              style={({ pressed }) => ({
                minHeight: 36,
                paddingHorizontal: spacing.md,
                justifyContent: 'center',
                borderRadius: radii.pill,
                backgroundColor: pressed ? colors.well : colors.card,
              })}>
              <Text variant="callout">{MUSCLE_GROUP_LABELS[m]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {q ? (
        <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
          {foundMuscles.length === 0 && foundLifts.length === 0 ? (
            <Text color="text2" style={{ padding: spacing.lg }}>
              Nothing you’ve logged matches that.
            </Text>
          ) : null}
          {foundMuscles.map((m, i) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`${MUSCLE_GROUP_LABELS[m]} progress`}
              onPress={() => openMuscle(m)}
              style={({ pressed }) => ({
                padding: spacing.lg,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.sep,
                backgroundColor: pressed ? colors.well : 'transparent',
              })}>
              <Text style={{ fontFamily: fonts.semibold }}>{MUSCLE_GROUP_LABELS[m]}</Text>
              <Text variant="caption" color="text2">
                Muscle: workouts, PRs and progress
              </Text>
            </Pressable>
          ))}
          {foundLifts.map((e, i) => {
            const d = liftDetail(e.exerciseId);
            return (
              <LiftRow
                key={e.exerciseId}
                first={i === 0 && foundMuscles.length === 0}
                name={e.exerciseName}
                detail={d.detail}
                trend={d.trend}
                trendColor={d.down ? colors.kcal : colors.up}
                onPress={() => openLift(e.exerciseId)}
              />
            );
          })}
        </View>
      ) : (
        <>
          <Segmented
            accessibilityLabel="Show"
            value={view}
            onChange={setView}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'lifts', label: 'Lifts' },
              { value: 'records', label: 'Records' },
            ]}
          />
          {view === 'overview' ? <OverviewView sets={sets} classes={classes} range={range} onRange={setRange} /> : null}
          {view === 'lifts' ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" color="text2">
                Every lift you’ve logged, most recent first, with its last 12 weeks.
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
                {exercises.map((e, i) => {
                  const d = liftDetail(e.exerciseId);
                  return (
                    <LiftRow
                      key={e.exerciseId}
                      first={i === 0}
                      name={e.exerciseName}
                      detail={d.detail}
                      trend={d.trend}
                      trendColor={d.down ? colors.kcal : colors.up}
                      onPress={() => openLift(e.exerciseId)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
          {view === 'records' ? (
            <View style={{ gap: spacing.md }}>
              {records.map((row) => (
                <RecordsCard key={row.exercise.id} {...row} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
