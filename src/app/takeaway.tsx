import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ModalScreen } from '@/components/ModalScreen';
import { Text } from '@/components/Text';
import { TAKEAWAY_CUISINES, TAKEAWAYS, type TakeawayCuisine, type TakeawayDish, type TakeawaySize } from '@/data/takeaways';
import { useDb } from '@/database/DatabaseProvider';
import { saveTakeawayFood } from '@/database/repositories/foodRepository';
import { MEAL_CATEGORIES, MEAL_LABELS, mealCategoryFor } from '@/domain/meals';
import type { MealCategory } from '@/domain/types';
import { finishAdd } from '@/features/nutrition/basket';
import { logAndAnnounce } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

const isMeal = (v: string | undefined): v is MealCategory => !!v && (MEAL_CATEGORIES as string[]).includes(v);

/** Takeaway estimates: pick the cuisine, the dish and how big; it's logged marked ≈. */
export default function TakeawayScreen() {
  const params = useLocalSearchParams<{ meal?: string }>();
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [cuisine, setCuisine] = useState<TakeawayCuisine>('Chinese');
  const [open, setOpen] = useState<string | null>(null);
  const meal: MealCategory = isMeal(params.meal) ? params.meal : mealCategoryFor(new Date());

  const log = async (dish: TakeawayDish, size: TakeawaySize) => {
    const entry = await safely(`log ${dish.name}`, async () => {
      const food = await saveTakeawayFood(db, dish, size);
      return logAndAnnounce(db, { kind: 'food', id: food.id }, 1, meal);
    });
    if (entry) finishAdd(router);
  };

  const pill = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radii.pill,
        backgroundColor: selected ? colors.accent : colors.well,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text variant="callout" style={{ fontFamily: fonts.semibold, color: selected ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ModalScreen title="Takeaway" onClose={() => router.back()}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {TAKEAWAY_CUISINES.map((c) =>
          pill(c, c === cuisine, () => {
            setCuisine(c);
            setOpen(null);
          }),
        )}
      </ScrollView>
      <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
        {`Estimates for typical UK takeaway portions, marked ≈. Adding to ${MEAL_LABELS[meal]}.`}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
        {TAKEAWAYS.filter((d) => d.cuisine === cuisine).map((d, i) => {
          const regular = d.sizes.find((s) => s.label === 'Regular') ?? d.sizes[0];
          const expanded = open === d.id || d.sizes.length === 1;
          return (
            <View key={d.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.sep }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={d.sizes.length === 1 ? `${d.name}, ≈ ${regular.kcal} kcal a slice` : d.name}
                accessibilityState={{ expanded }}
                onPress={() => (d.sizes.length === 1 ? void log(d, d.sizes[0]) : setOpen(expanded ? null : d.id))}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  backgroundColor: pressed ? colors.well : colors.card,
                })}>
                <Text style={{ flex: 1, fontFamily: fonts.medium }}>{d.name}</Text>
                <Text variant="caption" color="text2" numeric>
                  {d.sizes.length === 1 ? `≈ ${regular.kcal} kcal a slice` : `≈ ${regular.kcal} kcal regular`}
                </Text>
              </Pressable>
              {expanded && d.sizes.length > 1 ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
                  {d.sizes.map((s) => (
                    <Pressable
                      key={s.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.label} ${d.name}, about ${s.kcal} kcal, ${s.proteinG} g protein`}
                      onPress={() => void log(d, s)}
                      style={({ pressed }) => ({
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: spacing.sm,
                        borderRadius: radii.control,
                        backgroundColor: colors.well,
                        opacity: pressed ? 0.7 : 1,
                      })}>
                      <Text variant="callout" style={{ fontFamily: fonts.semibold }}>
                        {s.label}
                      </Text>
                      <Text variant="caption" color="text2" numeric>{`≈ ${s.kcal} kcal · ${s.proteinG} g`}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </ModalScreen>
  );
}
