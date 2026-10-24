import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { drinksSummary } from '@/domain/dayStatus';
import { amountLabel, kcalLabel } from '@/domain/format';
import { MEAL_LABELS } from '@/domain/meals';
import type { FoodLogEntry } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

/** Liquid calories: every drink (anything in ml), whichever meal it was had with; tap for the list. */
export function DrinksChip({ entries, isToday }: { entries: FoodLogEntry[]; isToday: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const drinks = drinksSummary(entries);
  if (drinks.count === 0) return null;
  const label = `${isToday ? 'Drinks today' : 'Drinks'}: ${drinks.count} · ${drinks.kcal.toLocaleString('en-GB')} kcal`;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Lists each drink"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs + 2,
          borderRadius: radii.pill,
          backgroundColor: colors.well,
          opacity: pressed ? 0.6 : 1,
        })}>
        <Text variant="caption" numeric style={{ fontFamily: fonts.semibold }}>
          {label}
        </Text>
      </Pressable>
      <Sheet visible={open} title="Drinks" closeLabel="Done" onClose={() => setOpen(false)}>
        <View style={{ gap: spacing.sm }}>
          {drinks.entries.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'baseline' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.medium }}>{e.name}</Text>
                <Text variant="caption" color="text2" numeric>
                  {`${MEAL_LABELS[e.mealCategory]} · ${e.count ?? amountLabel(e.amount, e.unit)}`}
                </Text>
              </View>
              <Text numeric>{kcalLabel(e.nutrients, e.isApproximate)}</Text>
            </View>
          ))}
        </View>
      </Sheet>
    </>
  );
}
