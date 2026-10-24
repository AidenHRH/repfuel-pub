import { useState } from 'react';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { logAgain } from '@/database/repositories/dayRepository';
import { MEAL_CATEGORIES, MEAL_LABELS, mealCategoryFor } from '@/domain/meals';
import type { FoodLogEntry, MealCategory } from '@/domain/types';
import { announce } from '@/features/nutrition/events';
import { safely } from '@/features/safely';

/** Hold an entry → log it again today, same amounts, into the meal you pick (the one for now to start with). */
export function LogAgainSheet({ entry, onClose }: { entry: FoodLogEntry | null; onClose: () => void }) {
  const db = useDb();
  const [meal, setMeal] = useState<MealCategory>(() => mealCategoryFor(new Date()));
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Each time the sheet opens for an entry, start from the meal for now.
  if (entry && shownFor !== entry.id) {
    setShownFor(entry.id);
    setMeal(mealCategoryFor(new Date()));
  }

  const log = async () => {
    if (!entry) return;
    const copy = await safely(`log ${entry.name} again`, () => logAgain(db, entry.id, meal));
    onClose();
    if (copy) announce(copy);
  };

  return (
    <Sheet visible={entry !== null} title="Log again today" onClose={onClose}>
      <Text color="text2">{entry ? `${entry.name}, same amount. Which meal?` : ''}</Text>
      <Segmented
        accessibilityLabel="Meal"
        options={MEAL_CATEGORIES.map((m) => ({ value: m, label: MEAL_LABELS[m] }))}
        value={meal}
        onChange={setMeal}
      />
      <Button label={`Log at ${MEAL_LABELS[meal].toLowerCase()}`} onPress={() => void log()} />
    </Sheet>
  );
}
