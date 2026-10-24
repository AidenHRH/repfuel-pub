import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { FoodThumb } from '@/components/FoodThumb';
import { Text } from '@/components/Text';
import { localTimeLabel } from '@/domain/dates';
import { MAIN_MEALS } from '@/domain/dayStatus';
import { amountLabel, kcalLabel } from '@/domain/format';
import { MEAL_CATEGORIES } from '@/domain/meals';
import { roundForDisplay, sumEntries, type DayTotals } from '@/domain/nutrition';
import type { FoodLogEntry, MealCategory } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

const SECTION: Record<MealCategory, { label: string; log: string }> = {
  breakfast: { label: 'Breakfast', log: 'Log breakfast' },
  lunch: { label: 'Lunch', log: 'Log lunch' },
  dinner: { label: 'Dinner', log: 'Log dinner' },
  snack: { label: 'Snacks', log: 'Log a snack' },
  drink: { label: 'Drinks', log: 'Log a drink' },
};

type Props = {
  entries: FoodLogEntry[];
  skipped: MealCategory[];
  /** Main meals that can be marked skipped now (past days, or today once the meal's time has gone). */
  canSkip: MealCategory[];
  onLog: (meal: MealCategory) => void;
  onToggleSkipped: (meal: MealCategory, on: boolean) => void;
  onEdit: (entry: FoodLogEntry) => void;
  onDelete: (entry: FoodLogEntry) => void;
  onLogAgain: (entry: FoodLogEntry) => void;
};

/** Breakfast, Lunch, Dinner, Snacks and Drinks, always in that order, each with its total and Log. */
export function MealList({ entries, skipped, canSkip, onLog, onToggleSkipped, onEdit, onDelete, onLogAgain }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {MEAL_CATEGORIES.map((meal) => {
        const inMeal = entries.filter((e) => e.mealCategory === meal);
        const isSkipped = skipped.includes(meal) && inMeal.length === 0;
        const totals = inMeal.length
          ? sumEntries(inMeal.map((e) => ({ ...e.nutrients, isApproximate: e.isApproximate })))
          : null;
        return (
          <View key={meal} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs }}>
              <Text variant="overline" color="text2" accessibilityRole="header">
                {SECTION[meal].label}
              </Text>
              {totals ? (
                <Text variant="caption" color="text2" numeric>
                  {sectionTotals(totals)}
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              {inMeal.length === 0 && MAIN_MEALS.includes(meal) && (isSkipped || canSkip.includes(meal)) ? (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={`Skipped ${SECTION[meal].label.toLowerCase()}`}
                  accessibilityState={{ checked: isSkipped }}
                  hitSlop={6}
                  onPress={() => onToggleSkipped(meal, !isSkipped)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                    borderRadius: radii.pill,
                    backgroundColor: isSkipped ? colors.well : 'transparent',
                    borderWidth: 1,
                    borderColor: isSkipped ? colors.well : colors.sep,
                  }}>
                  <Text variant="caption" color="text2">
                    {isSkipped ? 'Skipped ✓' : 'Skipped?'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={SECTION[meal].log}
                hitSlop={8}
                onPress={() => onLog(meal)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: 4,
                  borderRadius: radii.pill,
                  backgroundColor: colors.well,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <Text variant="caption" color="accent" style={{ fontFamily: fonts.semibold }}>
                  + Log
                </Text>
              </Pressable>
            </View>
            {inMeal.length ? (
              <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
                {inMeal.map((entry, i) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    first={i === 0}
                    onEdit={() => onEdit(entry)}
                    onDelete={() => onDelete(entry)}
                    onLogAgain={() => onLogAgain(entry)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
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
  onLogAgain,
}: {
  entry: FoodLogEntry;
  first: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLogAgain: () => void;
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
          accessibilityHint="Opens to adjust. Swipe left to edit or delete; hold to log it again today."
          accessibilityActions={[
            { name: 'activate' },
            { name: 'edit', label: 'Edit' },
            { name: 'delete', label: 'Delete' },
            { name: 'longpress', label: 'Log again' },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'delete') onDelete();
            else if (e.nativeEvent.actionName === 'longpress') onLogAgain();
            else onEdit();
          }}
          onPress={onEdit}
          onLongPress={onLogAgain}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md + 2,
            // Opaque, so the swipe actions stay hidden underneath until the row slides.
            backgroundColor: pressed ? colors.well : colors.card,
          })}>
          <FoodThumb uri={entry.photo} name={entry.name} size={40} />
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
