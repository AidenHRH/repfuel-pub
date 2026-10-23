import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { amountLabel, friendlyNumber, kcalLabel, proteinLabel } from '@/domain/format';
import { PORTIONS } from '@/domain/portions';
import type { Loggable, MealCategory } from '@/domain/types';
import { logAndAnnounce, nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, layout, radii, spacing } from '@/theme/tokens';

/** Taking a tile off its row, from the hold sheet: "Remove from Snacks". */
export type TileRemoval = { label: string; run: (foodId: string) => Promise<void> };

/**
 * A row of one-tap tiles on Log food (Favourites, Snacks, Drinks). Tap logs one to `category`; hold for a portion
 * (¼ … 2) or, when the row allows it, to take it off the row. An empty row isn't shown.
 */
export function TileRow({
  title,
  items,
  category,
  onLogged,
  removal,
}: {
  title: string;
  items: Loggable[] | null;
  category: MealCategory;
  onLogged: () => void;
  removal?: TileRemoval;
}) {
  const db = useDb();
  const { colors } = useTheme();
  const [choosing, setChoosing] = useState<Loggable | null>(null);

  if (!items || items.length === 0) return null;

  const log = async (pick: Loggable, amount: number) => {
    const entry = await safely(`log ${pick.name}`, () => logAndAnnounce(db, pick, amount, category));
    if (entry) onLogged();
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: spacing.xs }}>
        <Text variant="overline" color="text2" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="caption" color="text2">
          Tap to log · hold for portions
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -layout.gutter }}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: spacing.md - 2 }}>
        {items.map((pick) => (
          <Pressable
            key={pick.id}
            accessibilityRole="button"
            accessibilityLabel={`Log ${amountLabel(pick.defaultAmount, pick.unit)} of ${pick.name}`}
            accessibilityHint="Hold to choose a different portion"
            onPress={() => void log(pick, pick.defaultAmount)}
            onLongPress={() => setChoosing(pick)}
            style={({ pressed }) => ({
              width: 128,
              minHeight: 92,
              backgroundColor: colors.card,
              borderRadius: radii.card,
              padding: spacing.md + 2,
              justifyContent: 'space-between',
              gap: spacing.md,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <Text variant="headline" style={{ fontSize: 15, lineHeight: 19 }} numberOfLines={2}>
              {pick.name}
            </Text>
            <View style={{ gap: 2 }}>
              <Text variant="caption" color="text2" numeric>
                {kcalLabel(pick.nutrients, pick.isApproximate)}
              </Text>
              <Text variant="caption" color="pro" numeric style={{ fontFamily: fonts.semibold }}>
                {proteinLabel(pick.nutrients)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Sheet visible={!!choosing} title={choosing?.name ?? ''} onClose={() => setChoosing(null)}>
        {choosing ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {PORTIONS.map((m) => {
                const amount = choosing.defaultAmount * m;
                return (
                  <Button
                    key={m}
                    variant={m === 1 ? 'primary' : 'secondary'}
                    label={friendlyNumber(m)}
                    accessibilityLabel={`Log ${amountLabel(amount, choosing.unit)}`}
                    style={{ flex: 1, paddingHorizontal: 0 }}
                    onPress={() => {
                      const pick = choosing;
                      setChoosing(null);
                      void log(pick, amount);
                    }}
                  />
                );
              })}
            </View>
            <Text variant="caption" color="text2">
              1 = {amountLabel(choosing.defaultAmount, choosing.unit)} · {kcalLabel(choosing.nutrients, choosing.isApproximate)} ·{' '}
              {proteinLabel(choosing.nutrients)}
            </Text>
            {removal ? (
              <Button
                variant="plain"
                label={removal.label}
                onPress={async () => {
                  const pick = choosing;
                  setChoosing(null);
                  await safely(`remove ${pick.name}`, () => removal.run(pick.id));
                  nutritionEvents.emit({ type: 'changed' });
                }}
              />
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
