import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Switch } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { createFood, setFoodShop } from '@/database/repositories/foodRepository';
import { recipeNameTaken, saveFoodAsMeal } from '@/database/repositories/recipeRepository';
import { logAndAnnounce, nutritionEvents } from '@/features/nutrition/events';
import {
  emptyFoodForm,
  formFromDraft,
  missingLabel,
  splitMissing,
  sourceForScanned,
  validateFoodForm,
  type FoodFormErrors,
} from '@/features/nutrition/foodForm';
import { FoodFormView } from '@/features/nutrition/FoodFormView';
import { pickIngredient } from '@/features/nutrition/ingredientPick';
import { ShopPicker } from '@/features/nutrition/ShopPicker';
import { safely } from '@/features/safely';
import { MEAL_CATEGORIES } from '@/domain/meals';
import type { MealCategory } from '@/domain/types';
import type { FoodDraft } from '@/services/food-provider/types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const isMeal = (v: string | undefined): v is MealCategory => !!v && (MEAL_CATEGORIES as string[]).includes(v);

function parseDraft(json: string | undefined): FoodDraft | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as FoodDraft;
  } catch {
    return null;
  }
}

export default function NewFoodScreen() {
  const params = useLocalSearchParams<{
    quick?: string;
    barcode?: string;
    draft?: string;
    cached?: string;
    meal?: string;
    /** `ingredient`: checking a scanned product for a meal being built, which gets it back once saved. */
    for?: string;
  }>();
  const forIngredient = params.for === 'ingredient';
  const mealCategory = isMeal(params.meal) ? params.meal : undefined;
  const isQuick = params.quick === '1';
  const barcode = params.barcode || null;
  const draft = useMemo(() => parseDraft(params.draft), [params.draft]);
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  // A quick meal goes into My meals by default so it logs again in one tap.
  const [saveAsMeal, setSaveAsMeal] = useState(isQuick);
  const [values, setValues] = useState(() => (draft ? formFromDraft(draft) : emptyFoodForm({ approximate: isQuick })));
  const [errors, setErrors] = useState<FoodFormErrors>({});
  const [shop, setShop] = useState<string | null>(draft?.shop ?? null);

  const save = async (andLog: boolean) => {
    const result = validateFoodForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const food = {
      ...result.food,
      barcode,
      dataSource: draft ? sourceForScanned(draft, result.food) : result.food.dataSource,
      imageUrl: draft?.imageUrl ?? null,
      packSize: draft?.packSize ?? null,
      health: draft?.health ?? null,
      shop,
    };
    const asMeal = isQuick && saveAsMeal && food.basis === 'per_serving';
    if (asMeal && (await recipeNameTaken(db, food.name).catch(() => false))) {
      setErrors({
        name: `You already have a meal called “${food.name}”. Log it from My meals, or give this one another name.`,
      });
      return;
    }
    const saved = await safely(`save ${food.name}`, async () => {
      const created = await createFood(db, food);
      // The question was on screen: no pick counts as skipped, so it isn't asked again.
      if (!shop && !isQuick) await setFoodShop(db, created.id, null);
      return created;
    });
    if (!saved) return;
    if (forIngredient) {
      nutritionEvents.emit({ type: 'changed' });
      pickIngredient(saved.id);
      router.back();
      return;
    }
    const meal = asMeal ? await safely(`add ${food.name} to My meals`, () => saveFoodAsMeal(db, saved.id)) : null;
    nutritionEvents.emit({ type: 'changed' });
    if (andLog && saved.basis !== 'per_serving') {
      // Per-100 foods need an amount before they can be logged.
      router.replace({
        pathname: '/food/log',
        params: { id: saved.id, ...(mealCategory ? { meal: mealCategory } : {}) },
      });
      return;
    }
    router.dismissAll();
    if (andLog) {
      const item = meal ? ({ kind: 'recipe', id: meal.id } as const) : ({ kind: 'food', id: saved.id } as const);
      await safely(`log ${saved.name}`, () => logAndAnnounce(db, item, 1, mealCategory));
    }
  };

  const title = draft ? 'Check product' : isQuick ? 'Quick meal' : 'New food';

  return (
    <ModalScreen title={title} onClose={() => router.back()} action={{ label: 'Save', onPress: () => save(false) }}>
      {draft ? (
        <Card style={{ gap: spacing.xs }}>
          <Text variant="callout">
            {params.cached === '1' ? 'From Open Food Facts (saved earlier, couldn’t reach it just now)' : 'From Open Food Facts'}{' '}
            · check it against the pack
          </Text>
          {splitMissing(draft.missing).required.length ? (
            <Text variant="caption" color="danger">
              Add {missingLabel(splitMissing(draft.missing).required)} from the label: it isn’t listed and is needed for your
              totals.
            </Text>
          ) : null}
          {splitMissing(draft.missing).optional.length ? (
            <Text variant="caption" color="text2">
              Not listed: {missingLabel(splitMissing(draft.missing).optional)}. Add from the label, or leave blank and it stays
              unknown.
            </Text>
          ) : null}
        </Card>
      ) : null}
      {barcode ? (
        <Text variant="caption" color="text2" numeric style={{ paddingHorizontal: spacing.xs }}>
          Barcode {barcode}
        </Text>
      ) : null}
      <FoodFormView values={values} errors={errors} onChange={setValues} quick={isQuick} />
      {isQuick ? null : <ShopPicker value={shop} onChange={setShop} />}
      {isQuick ? (
        <ListGroup footer="Keeps it in My meals on Today, ready to log again in one tap.">
          <ListRow label="Save to My meals">
            <Switch
              accessibilityLabel="Save to My meals"
              value={saveAsMeal}
              onValueChange={setSaveAsMeal}
              trackColor={{ true: colors.accent, false: colors.well }}
              thumbColor="#FFFFFF"
            />
          </ListRow>
        </ListGroup>
      ) : null}
      {forIngredient ? null : <Button label="Save and log" onPress={() => save(true)} />}
    </ModalScreen>
  );
}
