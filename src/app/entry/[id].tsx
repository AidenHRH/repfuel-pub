import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { StarIcon } from '@/components/icons';
import { ListGroup } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDb } from '@/database/DatabaseProvider';
import { deleteEntry, getEntry, updateEntry } from '@/database/repositories/foodLogRepository';
import { entryMealStatus, saveEntryAsMeal, type EntryMealStatus } from '@/database/repositories/recipeRepository';
import { friendlyNumber } from '@/domain/format';
import { MEAL_CATEGORIES, MEAL_LABELS } from '@/domain/meals';
import { roundForDisplay } from '@/domain/nutrition';
import { parseAmount } from '@/domain/parse';
import { PORTIONS } from '@/domain/portions';
import type { FoodLogEntry, MealCategory } from '@/domain/types';
import { nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const PRESETS = PORTIONS.map(String);
const CATEGORIES = MEAL_CATEGORIES;

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const router = useRouter();
  const [entry, setEntry] = useState<FoodLogEntry | null>(null);
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<MealCategory>('snack');
  const [mealStatus, setMealStatus] = useState<EntryMealStatus>('unavailable');
  const { colors } = useTheme();

  useEffect(() => {
    getEntry(db, id).then(async (loaded) => {
      if (!loaded) return;
      setEntry(loaded);
      setAmountText(String(loaded.amount));
      setCategory(loaded.mealCategory);
      setMealStatus(await entryMealStatus(db, loaded).catch((): EntryMealStatus => 'unavailable'));
    });
  }, [db, id]);

  const close = () => router.back();

  if (!entry)
    return (
      <ModalScreen title="" onClose={close}>
        {null}
      </ModalScreen>
    );

  const amount = parseAmount(amountText);
  const valid = amount !== null && Number.isFinite(amount) && amount > 0;
  const factor = valid ? amount / entry.amount : 1;
  const counted = entry.unit === 'portion' || entry.unit === 'serving';
  const approx = entry.isApproximate ? '≈ ' : '';

  const save = async () => {
    if (!valid) return;
    const saved = await safely('save that change', () => updateEntry(db, entry.id, { amount, mealCategory: category }));
    if (!saved) return;
    nutritionEvents.emit({ type: 'changed' });
    close();
  };

  const saveAsMeal = async () => {
    const done = await safely(`save ${entry.name} as a meal`, async () => {
      await saveEntryAsMeal(db, entry);
      return true;
    });
    if (!done) return;
    setMealStatus('saved');
    nutritionEvents.emit({ type: 'changed' });
  };

  const remove = async () => {
    const done = await safely('delete that entry', async () => {
      await deleteEntry(db, entry.id);
      return true;
    });
    if (!done) return;
    nutritionEvents.emit({ type: 'changed' });
    nutritionEvents.emit({ type: 'deleted', entry });
    close();
  };

  return (
    <ModalScreen title={entry.name} onClose={close} action={{ label: 'Done', onPress: save, disabled: !valid }}>
      <View style={{ gap: spacing.xs, alignItems: 'center' }}>
        <Text variant="largeTitle" color="kcal" numeric>
          {`${approx}${roundForDisplay(entry.nutrients.kcal === null ? null : entry.nutrients.kcal * factor, 'kcal')} kcal`}
        </Text>
        <Text variant="headline" color="pro" numeric>
          {`${roundForDisplay(entry.nutrients.proteinG === null ? null : entry.nutrients.proteinG * factor, 'g')} g protein`}
        </Text>
      </View>

      {counted ? (
        <ListGroup title={entry.unit === 'portion' ? 'Portions' : 'Servings'}>
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <Segmented
              accessibilityLabel="Amount"
              value={PRESETS.includes(String(amount)) ? String(amount) : ''}
              onChange={setAmountText}
              options={PRESETS.map((p) => ({ value: p, label: friendlyNumber(Number(p)) }))}
            />
          </View>
          <TextField
            label="Custom"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            error={valid ? undefined : 'Enter an amount above 0'}
          />
        </ListGroup>
      ) : (
        <ListGroup title="Amount">
          <TextField
            label="Amount"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            suffix={entry.unit}
            error={valid ? undefined : 'Enter an amount above 0'}
          />
        </ListGroup>
      )}

      <ListGroup title="Meal">
        <View style={{ padding: spacing.md }}>
          <Segmented
            accessibilityLabel="Meal"
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map((c) => ({ value: c, label: MEAL_LABELS[c] }))}
          />
        </View>
      </ListGroup>

      {mealStatus === 'can_save' ? (
        <Button
          variant="secondary"
          label="Save as a meal"
          icon={<StarIcon color={colors.pro} size={18} />}
          onPress={saveAsMeal}
        />
      ) : null}
      {mealStatus === 'saved' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
          <StarIcon filled color={colors.kcal} size={16} />
          <Text variant="callout" color="text2">
            Saved to My meals
          </Text>
        </View>
      ) : null}

      <Button variant="secondary" label="Delete entry" onPress={remove} />
    </ModalScreen>
  );
}
