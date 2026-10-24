import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FoodThumb } from '@/components/FoodThumb';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import { localDayKey } from '@/domain/dates';
import { amountLabel, kcalLabel } from '@/domain/format';
import { MEAL_LABELS } from '@/domain/meals';
import { roundForDisplay, sumEntries } from '@/domain/nutrition';
import type { FoodLogEntry, MealCategory } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { basket } from './basket';
import { nutritionEvents } from './events';
import { useDayLog } from './useDayLog';

/** The basket's entries as saved (with photos and any changed amount), in the order they were added. */
export function useBasket(day: string | null): FoodLogEntry[] {
  const db = useDb();
  const [ids, setIds] = useState<string[]>(() => basket.items().map((e) => e.id));
  const [saved, setSaved] = useState<FoodLogEntry[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => basket.subscribe(() => setIds(basket.items().map((e) => e.id))), []);
  useEffect(() => nutritionEvents.subscribe(() => setVersion((v) => v + 1)), []);
  const key = ids.join(',');
  useEffect(() => {
    let cancelled = false;
    if (!key) return;
    entriesForDay(db, day ?? localDayKey(new Date())).then(
      (all) => !cancelled && setSaved(all),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db, day, key, version]);
  if (!key) return [];
  const byId = new Map(saved.map((e) => [e.id, e]));
  return ids.map((id) => byId.get(id) ?? basket.items().find((e) => e.id === id)!).filter(Boolean);
}

const MEAL_TITLE: Record<MealCategory, string> = {
  breakfast: 'Your breakfast',
  lunch: 'Your lunch',
  dinner: 'Your dinner',
  snack: 'Your snack',
  drink: 'Your drinks',
};

const isDrinkEntry = (e: FoodLogEntry) => e.unit === 'ml' || e.mealCategory === 'drink';

/** "Your lunch": what's been added so far, the meal's totals and what's left for the day; tap ✕ to take one out. */
export function BasketCard({
  entries,
  meal,
  day,
  onRemove,
  onOpen,
}: {
  entries: FoodLogEntry[];
  meal: MealCategory;
  day: string | null;
  onRemove: (entry: FoodLogEntry) => void;
  onOpen: (entry: FoodLogEntry) => void;
}) {
  const { colors } = useTheme();
  const log = useDayLog(day);
  if (entries.length === 0) return null;
  const { totals, approximate } = sumEntries(entries.map((e) => ({ ...e.nutrients, isApproximate: e.isApproximate })));
  const left = log && log !== 'error' ? log.targets.caloriesKcal - log.totals.totals.kcal : null;
  const count = `${entries.length} item${entries.length === 1 ? '' : 's'}`;
  return (
    <View
      accessible={false}
      style={{
        backgroundColor: colors.card,
        borderRadius: radii.card,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.accent,
      }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: 2 }}>
        <Text variant="headline" accessibilityRole="header">{`${MEAL_TITLE[meal]} · ${count}`}</Text>
        <Text variant="caption" color="text2" numeric>
          {`${approximate ? '≈ ' : ''}${roundForDisplay(totals.kcal, 'kcal')} kcal · ${roundForDisplay(totals.proteinG, 'g')} g protein${
            left !== null
              ? left >= 0
                ? ` · ${roundForDisplay(left, 'kcal')} kcal left ${day ? 'that day' : 'today'}`
                : ` · ${roundForDisplay(-left, 'kcal')} kcal over`
              : ''
          }`}
        </Text>
      </View>
      {entries.map((e) => (
        <View
          key={e.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.sep,
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${e.name}, ${amountLabel(e.amount, e.unit)}, ${kcalLabel(e.nutrients, e.isApproximate)}${isDrinkEntry(e) ? ', drink' : ''}`}
            accessibilityHint="Opens to change the amount"
            onPress={() => onOpen(e)}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              opacity: pressed ? 0.6 : 1,
            })}>
            <FoodThumb uri={e.photo} name={e.name} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium }} numberOfLines={1}>
                {e.name}
              </Text>
              <Text variant="caption" color="text2" numeric>
                {`${amountLabel(e.amount, e.unit)} · ${kcalLabel(e.nutrients, e.isApproximate)}${isDrinkEntry(e) ? ' · drink' : ''}${
                  e.mealCategory !== meal ? ` · ${MEAL_LABELS[e.mealCategory]}` : ''
                }`}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${e.name}`}
            hitSlop={10}
            onPress={() => onRemove(e)}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingHorizontal: spacing.xs })}>
            <Text color="text2">✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
