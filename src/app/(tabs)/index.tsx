import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PlusIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Snackbar } from '@/components/Snackbar';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { setSkipped } from '@/database/repositories/dayRepository';
import { deleteEntry, restoreEntry } from '@/database/repositories/foodLogRepository';
import { addDays, localDayKey, weekOf } from '@/domain/dates';
import { streak, type DayStage } from '@/domain/dayStatus';
import type { FoodLogEntry, MealCategory } from '@/domain/types';
import { nutritionEvents } from '@/features/nutrition/events';
import { useDayLog } from '@/features/nutrition/useDayLog';
import { safely } from '@/features/safely';
import { DailyHabits } from '@/features/summary/DailyHabits';
import { DayBar } from '@/features/summary/DayBar';
import { DayTotalsCards } from '@/features/summary/DayTotalsCards';
import { DrinksChip } from '@/features/summary/DrinksChip';
import { LogAgainSheet } from '@/features/summary/LogAgainSheet';
import { MealList } from '@/features/summary/MealList';
import { useDaySummaries } from '@/features/summary/useDaySummaries';
import { usePlanned } from '@/features/summary/usePlanned';
import { TourTarget } from '@/features/tour/TourTarget';
import { workoutEvents } from '@/features/workouts/events';
import { lineForDay } from '@/domain/motivation';
import { useSetting } from '@/features/useSetting';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, spacing } from '@/theme/tokens';

type SnackState =
  | { kind: 'logged'; key: string; entryId: string; name: string }
  | { kind: 'loggedMany'; key: string; entries: FoodLogEntry[] }
  | { kind: 'deleted'; key: string; entry: FoodLogEntry }
  | { kind: 'lift'; key: string; message: string };

/** The picker's reach: this week and the four before it. */
const WEEKS = 5;

/** The hour after which today's breakfast, lunch or dinner can be marked skipped. */
const MEAL_OVER: Partial<Record<MealCategory, number>> = { breakfast: 11, lunch: 15, dinner: 21 };

export default function TodayScreen() {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [picked, setPicked] = useState<string | null>(null);
  const log = useDayLog(picked);
  const today = localDayKey(new Date());
  const day = picked ?? today;
  const isToday = day === today;
  const [snack, setSnack] = useState<SnackState | null>(null);
  const [again, setAgain] = useState<FoodLogEntry | null>(null);
  const weeks = Array.from({ length: WEEKS }, (_, i) => weekOf(addDays(today, -7 * (WEEKS - 1 - i))));
  const summaries = useDaySummaries(weeks.flat());
  const summaryWeeks = summaries ? weeks.map((w, i) => summaries.slice(i * 7, i * 7 + 7)) : [];
  const stages: Record<string, DayStage> = {};
  for (const s of summaries ?? []) stages[s.day] = s.status.stage;
  const skipped = summaries?.find((s) => s.day === day)?.skipped ?? [];
  const now = new Date();
  const canSkip = (Object.keys(MEAL_OVER) as MealCategory[]).filter((m) => !isToday || now.getHours() >= MEAL_OVER[m]!);
  const [diary, setDiary] = useState(false);
  const [showMotivation] = useSetting('showMotivation', true);
  const planned = usePlanned(isToday);

  useEffect(
    () =>
      nutritionEvents.subscribe((event) => {
        if (event.type === 'deleted') setSnack({ kind: 'deleted', key: `d-${event.entry.id}`, entry: event.entry });
        if (event.type === 'logged')
          setSnack({ kind: 'logged', key: event.entry.id, entryId: event.entry.id, name: event.entry.name });
        if (event.type === 'loggedMany')
          setSnack({ kind: 'loggedMany', key: event.entries.map((e) => e.id).join(','), entries: event.entries });
      }),
    [],
  );

  // A lift logged from here gets its confirmation (and any PR) here too.
  useEffect(
    () =>
      workoutEvents.subscribe((event) => {
        if (event.type !== 'logged' || event.from !== 'today') return;
        const message = event.records.length ? `New PR · ${event.records[0].label}` : `Saved ${event.name}`;
        setSnack({ kind: 'lift', key: `l-${Date.now()}`, message });
      }),
    [],
  );

  // A second tap on Undo before the snackbar disappears must not run it twice.
  const undoing = useRef<string | null>(null);
  const undo = async () => {
    if (!snack || snack.kind === 'lift' || undoing.current === snack.key) return;
    undoing.current = snack.key;
    setSnack(null);
    await safely('undo that', async () => {
      if (snack.kind === 'logged') await deleteEntry(db, snack.entryId);
      else if (snack.kind === 'loggedMany') for (const e of snack.entries) await deleteEntry(db, e.id);
      else await restoreEntry(db, snack.entry);
    });
    nutritionEvents.emit({ type: 'changed' });
  };

  // Swipe → Delete: removed at once, with Undo in the snackbar.
  const removeEntry = async (entry: FoodLogEntry) => {
    const done = await safely(`delete ${entry.name}`, async () => {
      await deleteEntry(db, entry.id);
      return true;
    });
    if (!done) return;
    nutritionEvents.emit({ type: 'changed' });
    nutritionEvents.emit({ type: 'deleted', entry });
  };

  const toggleSkipped = async (meal: MealCategory, on: boolean) => {
    await safely('mark that meal', () => setSkipped(db, day, meal, on));
    nutritionEvents.emit({ type: 'changed' });
  };

  const logFood = (meal?: MealCategory) => {
    const query = [meal ? `meal=${meal}` : null, isToday ? null : `day=${day}`].filter(Boolean).join('&');
    router.push(query ? `/log-food?${query}` : '/log-food');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen
        header={
          <DayBar
            day={day}
            today={today}
            weeks={summaryWeeks}
            streak={streak(stages, today)}
            line={showMotivation && isToday ? lineForDay(today) : undefined}
            onPick={(d) => setPicked(d === today ? null : d)}
          />
        }
        bottomInset={72}>
        <TourTarget id="summary-rings">
          {log === 'error' ? (
            <EmptyState
              title="Couldn’t load that day’s food"
              message="Your data is safe. Close and reopen RepFuel to try again."
            />
          ) : log ? (
            <DayTotalsCards totals={log.totals} targets={log.targets} />
          ) : (
            <Card hero style={{ height: 230 }} />
          )}
        </TourTarget>

        {log && log !== 'error' ? <DrinksChip entries={log.entries} isToday={isToday} /> : null}

        {log && log !== 'error' ? (
          <View style={{ gap: spacing.xs, marginBottom: -spacing.md }}>
            <SectionHeader
              title="Meals"
              action={
                log.entries.length
                  ? { label: diary ? 'Hide diary' : 'View diary', onPress: () => setDiary((d) => !d) }
                  : undefined
              }
            />
            {log.entries.length === 0 ? (
              <Text variant="callout" color="text2">
                {isToday ? 'Nothing logged yet today' : 'Nothing logged this day'}
              </Text>
            ) : null}
          </View>
        ) : null}

        {log && log !== 'error' ? (
          <MealList
            entries={log.entries}
            skipped={skipped}
            canSkip={canSkip}
            planned={planned}
            diary={diary}
            onLog={logFood}
            onToggleSkipped={(meal, on) => void toggleSkipped(meal, on)}
            onEdit={(entry) => router.push(`/entry/${entry.id}`)}
            onDelete={(entry) => void removeEntry(entry)}
            onLogAgain={setAgain}
          />
        ) : null}

        <DailyHabits day={day} isToday={isToday} />
      </Screen>

      <LogAgainSheet entry={again} onClose={() => setAgain(null)} />

      {snack ? (
        <Snackbar
          key={snack.key}
          message={
            snack.kind === 'logged'
              ? `Logged ${snack.name}`
              : snack.kind === 'loggedMany'
                ? `Logged ${snack.entries.length} items`
                : snack.kind === 'deleted'
                  ? `Deleted ${snack.entry.name}`
                  : snack.message
          }
          onTimeout={() => setSnack((current) => (current?.key === snack.key ? null : current))}
          actions={
            snack.kind === 'lift'
              ? [
                  {
                    label: 'View',
                    onPress: () => {
                      setSnack(null);
                      router.navigate('/workouts');
                    },
                  },
                ]
              : [
                  { label: 'Undo', onPress: undo },
                  ...(snack.kind === 'logged'
                    ? [
                        {
                          label: 'Adjust',
                          onPress: () => {
                            setSnack(null);
                            router.push(`/entry/${snack.entryId}`);
                          },
                        },
                      ]
                    : []),
                ]
          }
        />
      ) : (
        <TourTarget id="log-food-pill" style={{ position: 'absolute', right: layout.gutter, bottom: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log food"
            onPress={() => logFood()}
            style={({ pressed }) => ({
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0px 10px 28px rgba(0,0,0,0.28)',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}>
            <PlusIcon color={colors.onAccent} size={28} />
          </Pressable>
        </TourTarget>
      )}
    </View>
  );
}
