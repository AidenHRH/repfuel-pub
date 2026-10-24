import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { BarcodeIcon, ChevronIcon } from '@/components/icons';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useDb } from '@/database/DatabaseProvider';
import { getFood, listFoods, savePresetFood } from '@/database/repositories/foodRepository';
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  listRecipes,
  loadRecipeMaps,
  updateRecipe,
  type NewIngredient,
} from '@/database/repositories/recipeRepository';
import { searchCommonFoods } from '@/domain/commonFoods';
import { amountLabel, friendlyNumber, kcalLabel, proteinLabel } from '@/domain/format';
import { MEAL_CATEGORIES, MEAL_LABELS, mealCategoryFor } from '@/domain/meals';
import { parseAmount } from '@/domain/parse';
import { findCycle, recipePortionNutrients } from '@/domain/recipes';
import type { FoodProduct, MealCategory, Recipe, RecipeIngredient } from '@/domain/types';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { AmountPicker, useAmount } from './AmountPicker';
import { logAndAnnounce, nutritionEvents } from './events';
import { onIngredientPicked } from './ingredientPick';

const CATEGORIES = MEAL_CATEGORIES;

const DRAFT_ID = '__draft__';
const SHARES = ['0.25', '0.5', '0.75', '1'];

// `index`: changing the ingredient at that place in the list rather than adding one.
type Picking =
  | { step: 'choose' }
  | { step: 'amount'; food: FoodProduct; index?: number; initial?: number }
  | { step: 'share'; recipe: Recipe; index?: number };

function foodUnit(food: FoodProduct): 'g' | 'ml' | 'serving' {
  return food.basis === 'per_serving' ? 'serving' : food.basis === 'per_100g' ? 'g' : 'ml';
}

/**
 * A recipe or saved meal, from foods (picked, built-in or scanned) and shares of other recipes, with per-portion
 * nutrition live. Tap an ingredient to change how much. With `now`, builds what was just cooked and logs one
 * portion straight away: an optional name, how many portions it made, a meal to file it under, and kept in My meals
 * if asked (on by default when it made more than one).
 */
export function RecipeEditor({ recipeId, now = false, meal }: { recipeId?: string; now?: boolean; meal?: string }) {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [portionsMade, setPortionsMade] = useState(1);
  const [ingredients, setIngredients] = useState<NewIngredient[]>([]);
  const [foods, setFoods] = useState<FoodProduct[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [tree, setTree] = useState<Map<string, Recipe>>(new Map());
  const [picking, setPicking] = useState<Picking | null>(null);
  const [amountText, setAmountText] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [category, setCategory] = useState<MealCategory>(() =>
    (CATEGORIES as string[]).includes(meal ?? '') ? (meal as MealCategory) : mealCategoryFor(new Date()),
  );
  const [keep, setKeep] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [allFoods, allRecipes] = await Promise.all([listFoods(db, {}), listRecipes(db, {})]);
      const existing = recipeId ? await getRecipe(db, recipeId) : null;
      // Everything reachable, including deleted foods and batches a meal still uses.
      const reached = await loadRecipeMaps(db, [...allRecipes.map((r) => r.id), ...(recipeId ? [recipeId] : [])]);
      const loaded = reached.recipes;
      const foodMap = new Map(allFoods.map((f) => [f.id, f]));
      for (const f of reached.foods.values()) if (!foodMap.has(f.id)) foodMap.set(f.id, f);
      if (cancelled) return;
      setFoods([...foodMap.values()]);
      setRecipes(allRecipes.filter((r) => r.id !== recipeId));
      setTree(loaded);
      if (existing) {
        setName(existing.name);
        setPortionsMade(existing.portionsMade);
        setIngredients(
          existing.ingredients.map(
            (ing): NewIngredient =>
              ing.kind === 'food'
                ? {
                    kind: 'food',
                    foodId: ing.foodId,
                    amount: ing.amount,
                    unit: ing.unit,
                  }
                : {
                    kind: 'recipe',
                    subRecipeId: ing.subRecipeId,
                    portions: ing.portions,
                  },
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, recipeId]);

  // A food scanned (and checked, if need be) for this meal comes back here; how much is asked once this screen is
  // showing again, so the sheet never opens over the closing camera.
  const [scanned, setScanned] = useState<FoodProduct | null>(null);
  useEffect(
    () =>
      onIngredientPicked(async (foodId) => {
        const food = await getFood(db, foodId);
        if (!food) return;
        setFoods((list) => [...list.filter((f) => f.id !== food.id), food]);
        setScanned(food);
      }),
    [db],
  );
  useFocusEffect(
    useCallback(() => {
      if (!scanned) return;
      setPicking({ step: 'amount', food: scanned });
      setScanned(null);
    }, [scanned]),
  );

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const selfId = recipeId ?? DRAFT_ID;

  const draft: Recipe = {
    id: selfId,
    name,
    portionsMade,
    notes: null,
    isFavourite: false,
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
    ingredients: ingredients.map(
      (ing, i) =>
        ({
          id: `${i}`,
          recipeId: selfId,
          sortOrder: i,
          ...ing,
        }) as RecipeIngredient,
    ),
  };
  const lookup = {
    food: (id: string) => foodById.get(id),
    recipe: (id: string) => (id === selfId ? draft : tree.get(id)),
  };

  let perPortion: ReturnType<typeof recipePortionNutrients> | null = null;
  try {
    perPortion = ingredients.length ? recipePortionNutrients(selfId, lookup) : null;
  } catch {
    perPortion = null;
  }

  const canSave = (now || name.trim().length > 0) && ingredients.length > 0;
  // Build a meal logs one portion: the whole plate, or one portion of a bigger batch.
  const totalsLabel = !now ? 'Per portion' : portionsMade > 1 ? 'Your portion' : 'Your plate';

  // Build a meal: save it (named after the meal if no name), log one portion, and keep it only if asked.
  const logNow = async () => {
    if (!canSave) return;
    const mealName = name.trim() || MEAL_LABELS[category];
    const entry = await safely(`log ${mealName}`, async () => {
      const recipe = await createRecipe(db, {
        name: mealName,
        portionsMade,
        ingredients,
        isFavourite: keep,
      });
      const logged = await logAndAnnounce(db, { kind: 'recipe', id: recipe.id }, 1, category);
      // The entry keeps its own nutrition, so a one-off plate can leave the lists straight away.
      if (!keep) await deleteRecipe(db, recipe.id);
      return logged;
    });
    if (entry) router.dismissAll();
  };

  const save = async () => {
    if (!canSave) return;
    try {
      if (recipeId) await updateRecipe(db, recipeId, { name, portionsMade, ingredients });
      else
        await createRecipe(db, {
          name,
          portionsMade,
          ingredients,
          isFavourite: true,
        });
      nutritionEvents.emit({ type: 'changed' });
      router.back();
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'Recipe contains itself'
          ? `${name.trim()} can't include itself.`
          : 'Couldn’t save. Try again.',
      );
    }
  };

  const amount = parseAmount(amountText);
  const amountValid = amount !== null && Number.isFinite(amount) && amount > 0;

  // Adds the ingredient, or puts it back in its place when changing one.
  const putIngredient = (next: NewIngredient, index?: number) => {
    setIngredients((list) => (index === undefined ? [...list, next] : list.map((ing, i) => (i === index ? next : ing))));
    setPicking(null);
  };
  const addShare = () => {
    if (picking?.step !== 'share' || !amountValid) return;
    putIngredient({ kind: 'recipe', subRecipeId: picking.recipe.id, portions: amount }, picking.index);
  };
  const changeIngredient = (ing: NewIngredient, index: number) => {
    if (ing.kind === 'food') {
      const food = foodById.get(ing.foodId);
      if (food) setPicking({ step: 'amount', food, index, initial: ing.amount });
      return;
    }
    const recipe = tree.get(ing.subRecipeId);
    if (!recipe) return;
    setAmountText(String(ing.portions));
    setPicking({ step: 'share', recipe, index });
  };
  const setPortions = (next: number) => {
    // Cooking more than one portion: keep the rest in My meals unless it's turned off.
    if (now && portionsMade === 1 && next > 1) setKeep(true);
    setPortionsMade(next);
  };

  // Recipes that would end up containing this one are left out of the picker.
  const choosable = recipes.filter(
    (r) =>
      !findCycle(selfId, [r.id], {
        food: lookup.food,
        recipe: (id) => tree.get(id),
      }),
  );
  const pickerRows = [
    ...choosable.map((r) => ({
      key: `r:${r.id}`,
      name: r.name,
      hint: 'Meal or batch',
      pick: () => {
        setAmountText('1');
        setPicking({ step: 'share', recipe: r });
      },
    })),
    ...foods
      .filter((f) => !f.deletedAt)
      .map((f) => ({
        key: `f:${f.id}`,
        name: f.name,
        hint: f.basis === 'per_serving' ? 'Servings' : f.basis === 'per_100g' ? 'Grams' : 'Millilitres',
        pick: () => {
          setAmountText(f.basis === 'per_serving' ? '1' : '');
          setPicking({ step: 'amount', food: f });
        },
      })),
  ].filter((row) => row.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()));
  // Everyday foods with typical values (loose veg has no barcode), unless already saved.
  const savedPresets = new Set(foods.filter((f) => f.presetId && !f.deletedAt).map((f) => f.presetId));
  const builtInRows = searchCommonFoods(pickerSearch)
    .filter((c) => !savedPresets.has(c.id))
    .map((c) => ({
      key: `c:${c.id}`,
      name: c.name,
      hint: 'Typical values',
      pick: async () => {
        const food = await safely(`add ${c.name}`, () => savePresetFood(db, c));
        if (!food) return;
        setFoods((list) => [...list.filter((f) => f.id !== food.id), food]);
        setPicking({ step: 'amount', food });
      },
    }));
  const allPickerRows = [...pickerRows, ...builtInRows];

  return (
    <ModalScreen
      title={now ? 'Build a meal' : recipeId ? 'Edit recipe' : 'New recipe'}
      onClose={() => router.back()}
      action={now ? { label: 'Log', onPress: logNow, disabled: !canSave } : { label: 'Save', onPress: save, disabled: !canSave }}>
      <ListGroup>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder={now ? 'Optional, e.g. Steak bowl' : 'e.g. Pico salad'}
          autoFocus={!recipeId && !now}
        />
        <ListRow label={`Makes ${friendlyNumber(portionsMade)} portion${portionsMade === 1 ? '' : 's'}`}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StepButton
              label="−"
              accessibilityLabel="Fewer portions"
              disabled={portionsMade <= 1}
              onPress={() => setPortions(Math.max(1, portionsMade - 1))}
            />
            <StepButton label="+" accessibilityLabel="More portions" onPress={() => setPortions(portionsMade + 1)} />
          </View>
        </ListRow>
      </ListGroup>

      <ListGroup
        title={now ? 'On your plate' : 'Ingredients'}
        footer="Tap an ingredient to change how much. A batch, like a bowl of pico, can go in as a share: ¼, ½ or a whole portion.">
        {ingredients.map((ing, i) => {
          const label =
            ing.kind === 'food'
              ? (foodById.get(ing.foodId)?.name ?? 'Unknown food')
              : (tree.get(ing.subRecipeId)?.name ?? 'Unknown recipe');
          const amountText = ing.kind === 'food' ? amountLabel(ing.amount, ing.unit) : `${amountLabel(ing.portions, 'portion')}`;
          return (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingRight: spacing.xs,
                minHeight: 52,
              }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Change ${label}, ${amountText}`}
                onPress={() => changeIngredient(ing, i)}
                style={({ pressed }) => ({
                  flex: 1,
                  gap: 2,
                  paddingLeft: spacing.lg,
                  paddingVertical: spacing.sm,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <Text style={{ fontFamily: fonts.medium }} numberOfLines={1}>
                  {label}
                </Text>
                <Text variant="caption" color="text2" numeric>
                  {amountText}
                </Text>
              </Pressable>
              <Button
                variant="plain"
                label="Remove"
                accessibilityLabel={`Remove ${label}`}
                onPress={() => setIngredients((list) => list.filter((_, j) => j !== i))}
              />
            </View>
          );
        })}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add ingredient"
            onPress={() => {
              setPickerSearch('');
              setPicking({ step: 'choose' });
            }}
            style={{
              flex: 1,
              minHeight: 50,
              paddingHorizontal: spacing.lg,
              justifyContent: 'center',
            }}>
            <Text color="accent" style={{ fontFamily: fonts.semibold }}>
              Add ingredient
            </Text>
          </Pressable>
          <Button
            variant="secondary"
            label="Scan"
            accessibilityLabel="Scan ingredient"
            icon={<BarcodeIcon color={colors.accent} size={18} />}
            onPress={() => router.push({ pathname: '/scan', params: { for: 'ingredient' } })}
            style={{ paddingHorizontal: spacing.md, minHeight: 36 }}
          />
        </View>
      </ListGroup>

      {now ? (
        <ListGroup title="Meal" footer="Kept meals are in Saved meals on Log food, ready to log again in one tap.">
          <View style={{ padding: spacing.md }}>
            <Segmented
              accessibilityLabel="Meal"
              value={category}
              onChange={setCategory}
              options={CATEGORIES.map((c) => ({
                value: c,
                label: MEAL_LABELS[c],
              }))}
            />
          </View>
          <ListRow label="Save to My meals">
            <Switch
              accessibilityLabel="Save to My meals"
              value={keep}
              onValueChange={setKeep}
              trackColor={{ true: colors.accent, false: colors.well }}
              thumbColor="#FFFFFF"
            />
          </ListRow>
        </ListGroup>
      ) : null}

      <Card accessibilityLabel={totalsLabel} style={{ gap: spacing.xs }}>
        <Text variant="overline" color="text2">
          {totalsLabel}
        </Text>
        <Text variant="title" color="kcal" numeric>
          {perPortion ? kcalLabel(perPortion.nutrients, perPortion.isApproximate) : '— kcal'}
        </Text>
        <Text variant="callout" color="pro" numeric>
          {perPortion ? proteinLabel(perPortion.nutrients) : '— g protein'}
        </Text>
      </Card>

      {error ? (
        <Text variant="callout" color="danger">
          {error}
        </Text>
      ) : null}

      <Sheet
        visible={!!picking}
        title={
          picking?.step === 'amount' ? picking.food.name : picking?.step === 'share' ? picking.recipe.name : 'Add ingredient'
        }
        onClose={() => setPicking(null)}>
        {picking?.step === 'choose' ? (
          <View style={{ gap: spacing.md }}>
            <TextInput
              accessibilityLabel="Search ingredients"
              placeholder="Search foods and meals"
              placeholderTextColor={colors.text2}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              selectionColor={colors.accent}
              style={{
                backgroundColor: colors.well,
                borderRadius: radii.control,
                minHeight: 44,
                paddingHorizontal: spacing.md,
                color: colors.text,
                fontFamily: fonts.regular,
                fontSize: 16,
              }}
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{
                backgroundColor: colors.well,
                borderRadius: radii.card,
                maxHeight: 360,
              }}>
              {allPickerRows.length === 0 ? (
                <Text variant="callout" color="text2" style={{ padding: spacing.lg }}>
                  Nothing matches. Scan it, or add it from Log food first.
                </Text>
              ) : null}
              {allPickerRows.map((row, i) => (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${row.name}`}
                  onPress={() => void row.pick()}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing.lg,
                    minHeight: 50,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.sep,
                    backgroundColor: pressed ? colors.card : 'transparent',
                  })}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1}>{row.name}</Text>
                    <Text variant="caption" color="text2">
                      {row.hint}
                    </Text>
                  </View>
                  <ChevronIcon color={colors.text2} size={16} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {picking?.step === 'share' ? (
          <Segmented
            accessibilityLabel="Share of the batch"
            value={SHARES.includes(String(amount)) ? String(amount) : ''}
            onChange={setAmountText}
            options={SHARES.map((s) => ({
              value: s,
              label: friendlyNumber(Number(s)),
            }))}
          />
        ) : null}

        {picking?.step === 'amount' ? (
          <IngredientAmount
            key={`${picking.food.id}:${picking.index ?? 'new'}`}
            food={picking.food}
            initial={picking.initial}
            doneLabel={picking.index === undefined ? 'Add' : 'Update'}
            onDone={(value) =>
              putIngredient({ kind: 'food', foodId: picking.food.id, amount: value, unit: foodUnit(picking.food) }, picking.index)
            }
          />
        ) : null}

        {picking?.step === 'share' ? (
          <Button label={picking.index === undefined ? 'Add' : 'Update'} onPress={addShare} disabled={!amountValid} />
        ) : null}
      </Sheet>
    </ModalScreen>
  );
}

/** How much of a food goes in: its sizes (a serving, the whole pack…), ¼…2, How many, or grams. */
function IngredientAmount({
  food,
  initial,
  doneLabel,
  onDone,
}: {
  food: FoodProduct;
  initial?: number;
  doneLabel: string;
  onDone: (amount: number) => void;
}) {
  const { colors } = useTheme();
  const how = useAmount(food, initial);
  return (
    <>
      <View style={{ backgroundColor: colors.well, borderRadius: radii.card, overflow: 'hidden' }}>
        <AmountPicker food={food} state={how} />
      </View>
      <Button label={doneLabel} onPress={() => onDone(how.amount)} disabled={!how.valid} />
    </>
  );
}

function StepButton(props: { label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={{
        width: 44,
        height: 36,
        borderRadius: 10,
        backgroundColor: colors.well,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: props.disabled ? 0.4 : 1,
      }}>
      <Text variant="title" color="accent">
        {props.label}
      </Text>
    </Pressable>
  );
}
