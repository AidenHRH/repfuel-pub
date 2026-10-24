import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { NutritionIcon, PlusIcon, WorkoutsIcon } from '@/components/icons';
import { MacroSummary } from '@/components/MacroSummary';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Snackbar } from '@/components/Snackbar';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { deleteEntry, restoreEntry } from '@/database/repositories/foodLogRepository';
import { localDayKey, localTimeLabel } from '@/domain/dates';
import { amountLabel, kcalLabel } from '@/domain/format';
import { groupByMeal } from '@/domain/meals';
import { lineForDay } from '@/domain/motivation';
import { roundForDisplay, type DayTotals } from '@/domain/nutrition';
import type { FoodLogEntry } from '@/domain/types';
import { nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import { useDayLog } from '@/features/nutrition/useDayLog';
import { TodayReminder } from '@/features/reminders/TodayReminder';
import { useSetting } from '@/features/useSetting';
import { workoutEvents } from '@/features/workouts/events';
import { PlannedNow } from '@/features/nutrition/PlannedNow';
import { ThisWeek } from '@/features/workouts/ThisWeek';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';
import { TourTarget } from '@/features/tour/TourTarget';

type SnackState =
  | { kind: 'logged'; key: string; entryId: string; name: string }
  | { kind: 'deleted'; key: string; entry: FoodLogEntry }
  | { kind: 'lift'; key: string; message: string };

const FLOATING = { height: 52, paddingHorizontal: spacing.xl, boxShadow: '0px 10px 28px rgba(0,0,0,0.28)' };

export default function TodayScreen() {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const log = useDayLog();
  const [snack, setSnack] = useState<SnackState | null>(null);
  const [showMotivation] = useSetting('showMotivation', true);

  useEffect(
    () =>
      nutritionEvents.subscribe((event) => {
        if (event.type === 'deleted') setSnack({ kind: 'deleted', key: `d-${event.entry.id}`, entry: event.entry });
        if (event.type === 'logged')
          setSnack({ kind: 'logged', key: event.entry.id, entryId: event.entry.id, name: event.entry.name });
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

  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen
        title="Summary"
        overline={dateLabel}
        subtitle={showMotivation ? lineForDay(localDayKey(new Date())) : undefined}
        bottomInset={72}>
        <TourTarget id="summary-rings">
          {log === 'error' ? (
            <EmptyState title="Couldn’t load today’s food" message="Your data is safe. Close and reopen RepFuel to try again." />
          ) : log ? (
            <MacroSummary totals={log.totals} targets={log.targets} />
          ) : (
            <Card hero style={{ height: 210 }} />
          )}
        </TourTarget>

        <TodayReminder />

        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Food today" action={{ label: 'Add', onPress: () => router.push('/search-food') }} />
          <PlannedNow />
          {log && log !== 'error' && log.entries.length === 0 ? (
            <EmptyState
              icon={<NutritionIcon color={colors.accent} />}
              title="Nothing logged yet today"
              message="Tap Log food: your meals, snacks and search are all there, one tap each."
            />
          ) : null}
          {log && log !== 'error'
            ? groupByMeal(log.entries).map((section) => (
                <View key={section.category} style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing.xs,
                    }}>
                    <Text variant="overline" color="text2" accessibilityRole="header">
                      {section.label}
                    </Text>
                    <Text variant="caption" color="text2" numeric>
                      {sectionTotals(section.totals)}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
                    {section.entries.map((entry, i) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        first={i === 0}
                        onEdit={() => router.push(`/entry/${entry.id}`)}
                        onDelete={() => void removeEntry(entry)}
                      />
                    ))}
                  </View>
                </View>
              ))
            : null}
        </View>

        <ThisWeek />
      </Screen>

      {snack ? (
        <Snackbar
          key={snack.key}
          message={
            snack.kind === 'logged'
              ? `Logged ${snack.name}`
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
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: spacing.lg,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.sm,
          }}>
          <TourTarget id="log-food-pill">
            <Button
              label="Log food"
              onPress={() => router.push('/log-food')}
              style={FLOATING}
              icon={<PlusIcon color={colors.onAccent} size={20} />}
            />
          </TourTarget>
          <TourTarget id="log-workout-pill">
            <Button
              label="Log workout"
              onPress={() => router.push('/lift/new?from=today')}
              style={FLOATING}
              icon={<WorkoutsIcon color={colors.onAccent} size={20} />}
            />
          </TourTarget>
        </View>
      )}
    </View>
  );
}

/** "452 kcal · 38 g"; ≈ when any entry is an estimate. */
function sectionTotals({ totals, approximate }: DayTotals): string {
  return `${approximate ? '≈ ' : ''}${roundForDisplay(totals.kcal, 'kcal')} kcal · ${roundForDisplay(totals.proteinG, 'g')} g`;
}

function EntryRow({
  entry,
  first,
  onEdit,
  onDelete,
}: {
  entry: FoodLogEntry;
  first: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const swipeable = useRef<SwipeableMethods>(null);
  const portion =
    entry.amount === 1 && (entry.unit === 'portion' || entry.unit === 'serving')
      ? ''
      : ` · ${amountLabel(entry.amount, entry.unit)}`;
  const kcal = kcalLabel(entry.nutrients, entry.isApproximate);
  const act = (action: () => void) => () => {
    swipeable.current?.close();
    action();
  };
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: colors.sep }}>
      <ReanimatedSwipeable
        ref={swipeable}
        friction={1.6}
        rightThreshold={48}
        overshootRight={false}
        renderRightActions={() => (
          <View style={{ flexDirection: 'row' }}>
            <SwipeAction
              label="Edit"
              accessibilityLabel={`Edit ${entry.name}`}
              background={colors.well}
              color={colors.accent}
              onPress={act(onEdit)}
            />
            <SwipeAction
              label="Delete"
              accessibilityLabel={`Delete ${entry.name}`}
              background={colors.danger}
              color="#FFFFFF"
              onPress={act(onDelete)}
            />
          </View>
        )}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${entry.name}, ${localTimeLabel(entry.loggedAt)}${portion}, ${kcal}, ${roundForDisplay(entry.nutrients.proteinG, 'g')} grams protein`}
          accessibilityHint="Opens to adjust. Swipe left to edit or delete."
          accessibilityActions={[{ name: 'activate' }, { name: 'edit', label: 'Edit' }, { name: 'delete', label: 'Delete' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'delete') onDelete();
            else onEdit();
          }}
          onPress={onEdit}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md + 2,
            // Opaque, so the swipe actions stay hidden underneath until the row slides.
            backgroundColor: pressed ? colors.well : colors.card,
          })}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontFamily: fonts.medium }} numberOfLines={1}>
              {entry.name}
            </Text>
            <Text variant="caption" color="text2" numeric>
              {`${localTimeLabel(entry.loggedAt)}${portion}`}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 3 }}>
            <Text variant="callout" numeric style={{ fontFamily: fonts.semibold }}>
              {kcal}
            </Text>
            <Text variant="caption" color="pro" numeric style={{ fontFamily: fonts.semibold }}>
              {`${roundForDisplay(entry.nutrients.proteinG, 'g')} g`}
            </Text>
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
}

function SwipeAction({
  label,
  accessibilityLabel,
  background,
  color,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  background: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 78,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
        opacity: pressed ? 0.8 : 1,
      })}>
      <Text variant="callout" style={{ color, fontFamily: fonts.semibold }}>
        {label}
      </Text>
    </Pressable>
  );
}
