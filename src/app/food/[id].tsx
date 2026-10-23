import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch } from 'react-native';

import { Button } from '@/components/Button';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { useDb } from '@/database/DatabaseProvider';
import { deleteFood, getFood, updateFood } from '@/database/repositories/foodRepository';
import { isInDrinksRow, isInSnacksRow, setInDrinksRow, setInSnacksRow } from '@/database/repositories/snackRepository';
import type { FoodProduct } from '@/domain/types';
import { nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import {
  editedFood,
  formFromFood,
  validateFoodForm,
  type FoodFormErrors,
  type FoodFormValues,
} from '@/features/nutrition/foodForm';
import { FoodFormView } from '@/features/nutrition/FoodFormView';
import { useTheme } from '@/theme/ThemeProvider';

type TileRows = { snacks: boolean; drinks: boolean };

export default function EditFoodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const router = useRouter();
  const [original, setOriginal] = useState<FoodProduct | null>(null);
  const [values, setValues] = useState<FoodFormValues | null>(null);
  const [errors, setErrors] = useState<FoodFormErrors>({});
  // The food's tiles on Log food, as loaded and as switched here.
  const [rows, setRows] = useState<{ was: TileRows; now: TileRows } | null>(null);
  const { colors } = useTheme();

  useEffect(() => {
    getFood(db, id).then(async (food) => {
      if (!food) return;
      const was = { snacks: await isInSnacksRow(db, food.id), drinks: await isInDrinksRow(db, food.id) };
      setRows({ was, now: was });
      setOriginal(food);
      setValues(formFromFood(food));
    });
  }, [db, id]);

  if (!values || !original)
    return (
      <ModalScreen title="" onClose={() => router.back()}>
        {null}
      </ModalScreen>
    );

  const save = async () => {
    const result = validateFoodForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const saved = await safely(`save ${result.food.name}`, async () => {
      const food = await updateFood(db, id, editedFood(original, result.food));
      if (rows && rows.now.snacks !== rows.was.snacks) await setInSnacksRow(db, id, rows.now.snacks);
      if (rows && rows.now.drinks !== rows.was.drinks) await setInDrinksRow(db, id, rows.now.drinks);
      return food;
    });
    if (!saved) return;
    nutritionEvents.emit({ type: 'changed' });
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert(`Delete ${values.name}?`, 'It leaves your saved foods. Past entries and meals that use it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await safely(`delete ${values.name}`, () => deleteFood(db, id));
          nutritionEvents.emit({ type: 'changed' });
          router.back();
        },
      },
    ]);

  return (
    <ModalScreen title="Edit food" onClose={() => router.back()} action={{ label: 'Save', onPress: save }}>
      <FoodFormView values={values} errors={errors} onChange={setValues} />
      <ListGroup footer="A tile on Log food: one tap logs it under Snacks or Drinks.">
        {(['snacks', 'drinks'] as const).map((row) => {
          const label = row === 'snacks' ? 'Show in Snacks' : 'Show in Drinks';
          return (
            <ListRow key={row} label={label}>
              <Switch
                accessibilityLabel={label}
                value={rows?.now[row] ?? false}
                onValueChange={(on) => setRows((r) => (r ? { ...r, now: { ...r.now, [row]: on } } : r))}
                trackColor={{ true: colors.pro, false: colors.well }}
                thumbColor="#FFFFFF"
              />
            </ListRow>
          );
        })}
      </ListGroup>
      <Button variant="secondary" label="Delete food" onPress={confirmDelete} />
    </ModalScreen>
  );
}
