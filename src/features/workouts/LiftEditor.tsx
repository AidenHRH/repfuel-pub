import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { ChevronIcon, TrophyIcon } from '@/components/icons';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { createExercise, getExercise, listExercises, recentExercises } from '@/database/repositories/exerciseRepository';
import {
  deleteLift,
  getLift,
  lastSession,
  logLift,
  setsForExercise,
  updateLift,
  type SetInput,
} from '@/database/repositories/liftRepository';
import { MUSCLE_GROUP_LABELS, TRACKING_LABELS, type Exercise, type MuscleGroup, type Tracking } from '@/domain/exercises';
import { formatDuration, setsLabel } from '@/domain/lifts';
import { parseAmount, parseDuration } from '@/domain/parse';
import { newRecords, type LiftSet } from '@/domain/records';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { workoutEvents } from './events';
import { SetFields, type SetDraft } from './SetFields';

const GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'full_body'];
const EMPTY_SET: SetDraft = { weight: '', reps: '', time: '', effort: null };
const KINDS = Object.keys(TRACKING_LABELS) as Tracking[];

/** Turns the typed sets into validated sets, or null if any is incomplete or invalid. */
export function parseSets(drafts: SetDraft[], tracking: Tracking = 'weight_reps'): SetInput[] | null {
  const sets: SetInput[] = [];
  for (const d of drafts) {
    const weight = parseAmount(d.weight);
    if (weight !== null && (Number.isNaN(weight) || weight < 0 || weight > 1000)) return null;
    if (tracking === 'time') {
      const seconds = parseDuration(d.time ?? '');
      if (seconds === null || Number.isNaN(seconds) || seconds > 3600) return null;
      sets.push({ weightKg: weight, reps: null, effort: d.effort, durationSeconds: seconds });
      continue;
    }
    const reps = parseAmount(d.reps);
    if (reps === null || !Number.isInteger(reps) || reps < 1 || reps > 100) return null;
    // Reps lowered after choosing how many were helped: all of them were.
    sets.push({ weightKg: weight, reps, effort: d.effort, ...(d.assisted ? { assistedReps: Math.min(d.assisted, reps) } : {}) });
  }
  return sets.length ? sets : null;
}

const toDraft = (s: SetInput): SetDraft => ({
  weight: s.weightKg === null ? '' : String(s.weightKg),
  reps: s.reps === null ? '' : String(s.reps),
  time: s.durationSeconds != null ? formatDuration(s.durationSeconds) : '',
  effort: s.effort,
  assisted: s.assistedReps ?? null,
});

/**
 * Log a lift: pick an exercise, enter sets shaped by how it's logged (weight × reps, reps only, or a time),
 * see any PR before saving, save. Also edits an existing lift. `switcher` is the Exercise | Class control.
 */
export function LiftEditor({
  workoutId,
  from = 'workouts',
  switcher,
}: {
  workoutId?: string;
  from?: 'today' | 'workouts';
  switcher?: ReactNode;
}) {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<SetDraft[]>([{ ...EMPTY_SET }]);
  const [at, setAt] = useState<Date | null>(null);
  const [lastTime, setLastTime] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [options, setOptions] = useState<Exercise[]>([]);
  const [recent, setRecent] = useState<Exercise[]>([]);
  const [customKind, setCustomKind] = useState<Tracking>('weight_reps');
  const [history, setHistory] = useState<LiftSet[]>([]);
  const [loggedAsReps, setLoggedAsReps] = useState(false);
  const reduceMotion = useReducedMotion();
  // Editing: nothing to show until the lift has loaded (never the exercise picker).
  const [loaded, setLoaded] = useState(!workoutId);
  // A quick second tap on Save must not log the lift twice.
  const saving = useRef(false);

  useEffect(() => {
    if (!workoutId) return;
    getLift(db, workoutId).then(async (lift) => {
      // Deleted meanwhile: nothing to edit.
      if (!lift) {
        router.back();
        return;
      }
      setExercise(await getExercise(db, lift.exerciseId));
      setAt(new Date(lift.at));
      setSets(lift.sets.map(toDraft));
      setLoggedAsReps(lift.sets.every((x) => x.durationSeconds == null));
      setLoaded(true);
    });
  }, [db, workoutId, router]);

  useEffect(() => {
    if (exercise) return;
    let cancelled = false;
    listExercises(db, { search, group: group ?? undefined }).then((list) => {
      if (!cancelled) setOptions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [db, exercise, search, group]);

  useEffect(() => {
    if (workoutId) return;
    let cancelled = false;
    recentExercises(db, 4).then(
      (list) => !cancelled && setRecent(list),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db, workoutId]);

  useEffect(() => {
    if (!exercise) return;
    let cancelled = false;
    const when = at ?? new Date();
    lastSession(db, exercise.id, when).then((lift) => {
      if (!cancelled) setLastTime(lift ? `Last time: ${setsLabel(lift.sets)}` : null);
    });
    // Everything logged before this lift, to show a PR as soon as the sets beat it.
    setsForExercise(db, exercise.id).then((all) => {
      if (!cancelled) setHistory(all.filter((s) => s.at < when.toISOString() && s.workoutId !== workoutId));
    });
    return () => {
      cancelled = true;
    };
  }, [db, exercise, at, workoutId]);

  // A lift logged before its exercise became timed (reps, no times) is edited the way it was logged.
  const tracking = exercise?.tracking === 'time' && loggedAsReps ? 'reps' : (exercise?.tracking ?? 'weight_reps');
  const parsed = parseSets(sets, tracking);
  const liveRecords = parsed
    ? newRecords(
        history,
        parsed.map((s) => ({ ...s, workoutId: 'draft', at: new Date().toISOString() })),
      )
    : [];
  const updateSet = (i: number, patch: Partial<SetDraft>) =>
    setSets((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const save = async () => {
    if (!exercise || !parsed || saving.current) return;
    saving.current = true;
    const input = { exerciseId: exercise.id, at: at ?? new Date(), sets: parsed };
    if (workoutId) {
      const done = await safely('save that lift', async () => {
        await updateLift(db, workoutId, input);
        return true;
      });
      if (!done) {
        saving.current = false;
        return;
      }
      workoutEvents.emit({ type: 'changed' });
    } else {
      const result = await safely('save that lift', () => logLift(db, input));
      if (!result) {
        saving.current = false;
        return;
      }
      workoutEvents.emit({ type: 'changed' });
      if (result.records.length) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      workoutEvents.emit({ type: 'logged', name: exercise.name, records: result.records, from });
    }
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Delete this lift?', 'Your records will be worked out again without it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!workoutId) return;
          await safely('delete that lift', () => deleteLift(db, workoutId));
          workoutEvents.emit({ type: 'changed' });
          router.back();
        },
      },
    ]);

  const addCustom = async () => {
    const made = await safely('add that exercise', () =>
      createExercise(db, {
        name: search,
        muscleGroup: group ?? 'other',
        equipment: 'other',
        isBodyweight: customKind !== 'weight_reps',
        tracking: customKind,
      }),
    );
    if (made) setExercise(made);
  };

  const title = workoutId ? 'Edit lift' : 'Log workout';

  if (!loaded)
    return (
      <ModalScreen title={title} onClose={() => router.back()}>
        {null}
      </ModalScreen>
    );

  if (!exercise) {
    const exact = options.some((o) => o.name.toLowerCase() === search.trim().toLowerCase());
    return (
      <ModalScreen title={title} onClose={() => router.back()}>
        {switcher}
        {recent.length ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" color="text2">
              Recent
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {recent.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Recent: ${r.name}`}
                  onPress={() => setExercise(r)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.lg,
                    minHeight: 40,
                    borderRadius: radii.pill,
                    justifyContent: 'center',
                    backgroundColor: pressed ? colors.well : colors.card,
                  })}>
                  <Text variant="callout">{r.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <TextInput
          accessibilityLabel="Search exercises"
          placeholder="Search exercises"
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {[null, ...GROUPS].map((g) => {
            const selected = g === group;
            return (
              <Pressable
                key={g ?? 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setGroup(g)}
                style={{
                  paddingHorizontal: spacing.lg,
                  minHeight: 36,
                  borderRadius: radii.pill,
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.pro : colors.card,
                }}>
                <Text variant="callout" color={selected ? 'onAccent' : 'text'}>
                  {g ? MUSCLE_GROUP_LABELS[g] : 'All'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
          {options.map((o, i) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${o.name}`}
              onPress={() => setExercise(o)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 52,
                paddingHorizontal: spacing.lg,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.sep,
                backgroundColor: pressed ? colors.well : 'transparent',
              })}>
              <View style={{ flex: 1 }}>
                <Text>{o.name}</Text>
                <Text variant="caption" color="text2">
                  {MUSCLE_GROUP_LABELS[o.muscleGroup]}
                  {o.isCustom ? ' · yours' : ''}
                </Text>
              </View>
              <ChevronIcon color={colors.text2} size={16} />
            </Pressable>
          ))}
          {search.trim() && !exact ? (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
                borderTopWidth: options.length ? 1 : 0,
                borderTopColor: colors.sep,
                gap: spacing.sm,
              }}>
              <Text variant="caption" color="text2">
                Logged as
              </Text>
              <Segmented
                accessibilityLabel="Logged as"
                value={customKind}
                onChange={setCustomKind}
                options={KINDS.map((k) => ({ value: k, label: TRACKING_LABELS[k] }))}
              />
            </View>
          ) : null}
          {search.trim() && !exact ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${search.trim()} as an exercise`}
              onPress={addCustom}
              style={{ minHeight: 52, paddingHorizontal: spacing.lg, justifyContent: 'center' }}>
              <Text color="pro" style={{ fontFamily: fonts.semibold }}>
                Add “{search.trim()}”{group ? ` to ${MUSCLE_GROUP_LABELS[group]}` : ''}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ModalScreen>
    );
  }

  return (
    <ModalScreen
      title={title}
      onClose={() => router.back()}
      footer={<Button label={`Save ${exercise.name}`} onPress={save} disabled={!parsed} haptic />}>
      {workoutId ? null : switcher}
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Text variant="largeTitle" style={{ fontSize: 28, lineHeight: 34, flexShrink: 1 }}>
            {exercise.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Button variant="plain" label="How to" onPress={() => router.push(`/exercise/${exercise.id}`)} />
            {workoutId ? null : <Button variant="plain" label="Change" onPress={() => setExercise(null)} />}
          </View>
        </View>
        <Text variant="callout" color="text2" numeric>
          {[
            MUSCLE_GROUP_LABELS[exercise.muscleGroup],
            tracking === 'weight_reps' ? null : TRACKING_LABELS[tracking],
            lastTime ?? 'First time logging this one',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {sets.map((s, i) => (
        <SetFields
          key={i}
          index={i}
          set={s}
          tracking={tracking}
          bodyweight={exercise.isBodyweight}
          onChange={(patch) => updateSet(i, patch)}
          onRemove={sets.length > 1 ? () => setSets((list) => list.filter((_, j) => j !== i)) : undefined}
        />
      ))}

      <Button
        variant="secondary"
        label="Add set"
        accessibilityLabel="Add set"
        onPress={() => setSets((list) => [...list, { ...(list[list.length - 1] ?? EMPTY_SET) }])}
      />

      {liveRecords.length ? (
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.duration(220)}
          accessibilityLiveRegion="polite"
          style={{
            backgroundColor: colors.prBg,
            borderRadius: radii.card,
            padding: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}>
          <TrophyIcon color={colors.pr} size={28} />
          <View style={{ flexShrink: 1, gap: 2 }}>
            <Text variant="headline" style={{ color: colors.pr }}>
              {liveRecords.every((r) => r.type === 'spotter') ? 'Spotter PR' : 'New PR'}
            </Text>
            {liveRecords.map((r) => (
              <Text key={r.type} variant="callout" style={{ color: colors.pr }}>
                {r.label}
              </Text>
            ))}
          </View>
        </Animated.View>
      ) : null}

      <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
        Effort is how hard the set felt: slide or tap, from 1 (easy) to 10 (couldn’t do another rep). Hold a number to clear it.
      </Text>
      {workoutId ? <Button variant="plain" label="Delete lift" onPress={confirmDelete} /> : null}
    </ModalScreen>
  );
}
