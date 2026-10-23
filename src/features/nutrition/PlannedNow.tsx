import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { getPlan, logPlannedMeal, planDayKeys, type PlanDayView } from '@/database/repositories/mealPlanRepository';
import { MEAL_LABELS, mealCategoryFor } from '@/domain/meals';
import { announce, nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

type Planned = PlanDayView['meals'][number];

/** The meal planned for this time of day, not yet logged, with a one-tap Log. Shows nothing otherwise. */
export function PlannedNow() {
  const db = useDb();
  const { colors } = useTheme();
  const [planned, setPlanned] = useState<{ day: string; meal: Planned } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => nutritionEvents.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    const [day] = planDayKeys(new Date(), 1);
    const slot = mealCategoryFor(new Date());
    getPlan(db, [day]).then(
      ([today]) => {
        const meal = today?.meals.find((m) => m.slot === slot && !m.logged);
        if (!cancelled) setPlanned(meal ? { day, meal } : null);
      },
      () => !cancelled && setPlanned(null),
    );
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  if (!planned) return null;
  const { meal } = planned;
  const kcal = meal.kcal === null ? null : Math.round(meal.kcal).toLocaleString('en-GB');

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radii.card,
        paddingLeft: spacing.lg,
        paddingRight: spacing.md,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="overline" color="text2">
          {`${MEAL_LABELS[meal.slot]} · planned`}
        </Text>
        <Text color="text2">{meal.name}</Text>
      </View>
      <Button
        variant="secondary"
        label={kcal ? `Log ${kcal}` : 'Log'}
        accessibilityLabel={`Log planned ${MEAL_LABELS[meal.slot].toLowerCase()}, ${meal.name}`}
        onPress={() => void safely('log this meal', async () => announce(await logPlannedMeal(db, planned.day, meal.slot)))}
        style={{ paddingHorizontal: spacing.lg, minHeight: 40 }}
      />
    </View>
  );
}
