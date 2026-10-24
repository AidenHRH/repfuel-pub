import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { FoodThumb } from '@/components/FoodThumb';
import { Text } from '@/components/Text';
import { localTimeLabel } from '@/domain/dates';
import { MAIN_MEALS } from '@/domain/dayStatus';
import { amountLabel, kcalLabel } from '@/domain/format';
import { MEAL_CATEGORIES } from '@/domain/meals';
import { roundForDisplay, sumEntries } from '@/domain/nutrition';
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

/** At most this many photos on a meal's card; the rest are "+2". */
const THUMBS = 5;

export type PlannedMeal = { name: string; onLog: () => void };

type Props = {
  entries: FoodLogEntry[];
  skipped: MealCategory[];
  /** Main meals that can be marked skipped now (past days, or today once the meal's time has gone). */
  canSkip: MealCategory[];
  /** Today's planned dishes not logged yet, by meal: Log logs it in one tap. */
  planned: Partial<Record<MealCategory, PlannedMeal>>;
  /** View diary: every item listed under its meal, with swipe to edit or delete. */
  diary: boolean;
  onLog: (meal: MealCategory) => void;
  onToggleSkipped: (meal: MealCategory, on: boolean) => void;
  onEdit: (entry: FoodLogEntry) => void;
  onDelete: (entry: FoodLogEntry) => void;
  onLogAgain: (entry: FoodLogEntry) => void;
};

const entryLabel = (entry: FoodLogEntry) => {
  const portion =
    entry.amount === 1 && (entry.unit === 'portion' || entry.unit === 'serving')
      ? ''
      : `, ${entry.count ?? amountLabel(entry.amount, entry.unit)}`;
  return `${entry.name}, ${localTimeLabel(entry.loggedAt)}${portion}, ${kcalLabel(entry.nutrients, entry.isApproximate)}, ${roundForDisplay(entry.nutrients.proteinG, 'g')} grams protein`;
};

/** Breakfast, Lunch, Dinner, Snacks and Drinks as cards, always in that order: totals, photos and Log. */
export function MealList({
  entries,
  skipped,
  canSkip,
  planned,
  diary,
  onLog,
  onToggleSkipped,
  onEdit,
  onDelete,
  onLogAgain,
}: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm + 2 }}>
      {MEAL_CATEGORIES.map((meal) => {
        const inMeal = entries.filter((e) => e.mealCategory === meal);
        const isSkipped = skipped.includes(meal) && inMeal.length === 0;
        const plan = inMeal.length === 0 ? planned[meal] : undefined;
        const totals = inMeal.length ? sumEntries(inMeal.map((e) => ({ ...e.nutrients, isApproximate: e.isApproximate }))) : null;
        const detail = totals
          ? `${totals.approximate ? '≈ ' : ''}${roundForDisplay(totals.totals.kcal, 'kcal')} kcal · ${roundForDisplay(totals.totals.proteinG, 'g')} g protein`
          : isSkipped
            ? 'skipped'
            : plan
              ? `planned: ${plan.name}`
              : meal === 'drink'
                ? 'on their own'
                : null;
        return (
          <View key={meal} style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={plan ? SECTION[meal].log : undefined}
                accessible={!!plan}
                disabled={!plan}
                onPress={() => onLog(meal)}
                style={{ flex: 1, gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 }}>
                  <Text variant="headline" accessibilityRole="header">
                    {SECTION[meal].label}
                  </Text>
                  {detail ? (
                    <Text variant="caption" color="text2" numeric>
                      {`· ${detail}`}
                    </Text>
                  ) : null}
                </View>
                {inMeal.length && !diary ? (
                  <View style={{ flexDirection: 'row', gap: spacing.xs + 2 }}>
                    {inMeal.slice(0, THUMBS).map((entry) => (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        accessibilityLabel={entryLabel(entry)}
                        accessibilityHint="Opens to adjust. Hold to log it again today."
                        accessibilityActions={[
                          { name: 'activate' },
                          { name: 'edit', label: 'Edit' },
                          { name: 'delete', label: 'Delete' },
                          { name: 'longpress', label: 'Log again' },
                        ]}
                        onAccessibilityAction={(e) => {
                          if (e.nativeEvent.actionName === 'delete') onDelete(entry);
                          else if (e.nativeEvent.actionName === 'longpress') onLogAgain(entry);
                          else onEdit(entry);
                        }}
                        onPress={() => onEdit(entry)}
                        onLongPress={() => onLogAgain(entry)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                        <FoodThumb uri={entry.photo} name={entry.name} size={40} word />
                      </Pressable>
                    ))}
                    {inMeal.length > THUMBS ? (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 9,
                          backgroundColor: colors.well,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <Text variant="caption" color="text2" numeric>{`+${inMeal.length - THUMBS}`}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
              {inMeal.length === 0 && MAIN_MEALS.includes(meal) && !plan && (isSkipped || canSkip.includes(meal)) ? (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={`Skipped ${SECTION[meal].label.toLowerCase()}`}
                  accessibilityState={{ checked: isSkipped }}
                  hitSlop={6}
                  onPress={() => onToggleSkipped(meal, !isSkipped)}
                  style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                  <Text variant="caption" color="text2">
                    {isSkipped ? 'Undo skip' : 'Skipped?'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={plan ? `Log planned ${SECTION[meal].label.toLowerCase()}, ${plan.name}` : SECTION[meal].log}
                hitSlop={6}
                onPress={plan ? plan.onLog : () => onLog(meal)}
                style={({ pressed }) => ({
                  minHeight: 40,
                  paddingHorizontal: spacing.lg + 2,
                  justifyContent: 'center',
                  borderRadius: radii.pill,
                  backgroundColor: plan ? colors.accent : colors.well,
                  opacity: pressed ? 0.7 : 1,
                })}>
                <Text variant="callout" style={{ fontFamily: fonts.semibold, color: plan ? colors.onAccent : colors.accent }}>
                  Log
                </Text>
              </Pressable>
            </View>
            {inMeal.length && diary ? (
              <View>
                {inMeal.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
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

function EntryRow({
  entry,
  onEdit,
  onDelete,
  onLogAgain,
}: {
  entry: FoodLogEntry;
  onEdit: () => void;
  onDelete: () => void;
  onLogAgain: () => void;
}) {
  const { colors } = useTheme();
  const swipeable = useRef<SwipeableMethods>(null);
  const portion =
    entry.amount === 1 && (entry.unit === 'portion' || entry.unit === 'serving')
      ? ''
      : ` · ${entry.count ?? amountLabel(entry.amount, entry.unit)}`;
  const kcal = kcalLabel(entry.nutrients, entry.isApproximate);
  const act = (action: () => void) => () => {
    swipeable.current?.close();
    action();
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.sep }}>
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
