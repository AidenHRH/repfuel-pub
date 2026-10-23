import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { BigNumber } from '@/components/BigNumber';
import { Button } from '@/components/Button';
import { StarIcon } from '@/components/icons';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { saveProductFood } from '@/database/repositories/barcodeRepository';
import { getFood, savePresetFood, setFoodFavourite } from '@/database/repositories/foodRepository';
import { isInDrinksRow, isInSnacksRow, setInDrinksRow, setInSnacksRow } from '@/database/repositories/snackRepository';
import { getCommonFood } from '@/domain/commonFoods';
import { isDrink } from '@/domain/drinks';
import { amountLabel, kcalLabel } from '@/domain/format';
import { MEAL_CATEGORIES, MEAL_LABELS, mealCategoryFor } from '@/domain/meals';
import { calculateLogged, roundForDisplay } from '@/domain/nutrition';
import type { FoodProduct, MealCategory } from '@/domain/types';
import { logAndAnnounce, nutritionEvents } from '@/features/nutrition/events';
import { AmountPicker, useAmount } from '@/features/nutrition/AmountPicker';
import { HealthCard } from '@/features/nutrition/HealthCard';
import { safely } from '@/features/safely';
import type { FoodDraft } from '@/services/food-provider/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';
import { TourTarget } from '@/features/tour/TourTarget';

const CATEGORIES = MEAL_CATEGORIES;

type Shown = Pick<
  FoodProduct,
  'name' | 'brand' | 'basis' | 'servingSize' | 'packSize' | 'nutrients' | 'dataSource' | 'imageUrl' | 'presetId' | 'health'
>;

function parseDraft(json: string | undefined): FoodDraft | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as FoodDraft;
  } catch {
    return null;
  }
}

const isMeal = (v: string | undefined): v is MealCategory => !!v && (CATEGORIES as string[]).includes(v);

/**
 * How much of a food to log, and to which meal. The food is a saved one (`id`), a product found by search or
 * scan (`draft`), or a built-in common food (`preset`); the last two are saved only when logged. Servings for
 * per-serving foods; g/ml for per-100 foods, with shortcuts for their measures (a serving, a cup, a large egg).
 */
export default function LogFoodAmountScreen() {
  const params = useLocalSearchParams<{ id?: string; draft?: string; barcode?: string; preset?: string; meal?: string }>();
  const db = useDb();
  const router = useRouter();
  const draft = useMemo(() => parseDraft(params.draft), [params.draft]);
  const [saved, setSaved] = useState<FoodProduct | null>(null);
  // Snacks and drinks only: keep it as a one-tap tile on Log food.
  const [alreadyTile, setAlreadyTile] = useState<{ snack: boolean; drink: boolean }>({ snack: false, drink: false });
  const [keepTile, setKeepTile] = useState(false);
  // Star: saved foods change at once; a new product is starred when it's saved on Log.
  const [favourite, setFavourite] = useState<boolean | null>(null);
  const { colors } = useTheme();
  // The meal chosen here or by the screen that opened this; otherwise a drink goes to Drinks and food by the clock.
  const [picked, setCategory] = useState<MealCategory | null>(() => (isMeal(params.meal) ? params.meal : null));

  const presetFromParams = params.preset ? getCommonFood(params.preset) : null;
  const food: Shown | null = saved
    ? saved
    : presetFromParams
      ? {
          name: presetFromParams.name,
          brand: null,
          basis: presetFromParams.basis,
          servingSize: presetFromParams.measures[0].grams,
          packSize: null,
          nutrients: presetFromParams.per100,
          dataSource: 'manual',
          imageUrl: null,
          presetId: presetFromParams.id,
          health: null,
        }
      : draft?.name
        ? {
            name: draft.name,
            brand: draft.brand,
            basis: draft.basis,
            servingSize: draft.servingSize,
            packSize: draft.packSize ?? null,
            nutrients: draft.nutrients,
            dataSource: 'open_food_facts',
            imageUrl: draft.imageUrl ?? null,
            presetId: null,
            health: draft.health ?? null,
          }
        : null;

  const how = useAmount(food);

  useEffect(() => {
    if (!params.id) return;
    getFood(db, params.id).then(async (loaded) => {
      if (!loaded) return;
      setSaved(loaded);
      setAlreadyTile({ snack: await isInSnacksRow(db, loaded.id), drink: await isInDrinksRow(db, loaded.id) });
    });
  }, [db, params.id]);

  if (!food)
    return (
      <ModalScreen title="" onClose={() => router.back()}>
        {null}
      </ModalScreen>
    );

  const category: MealCategory = picked ?? (isDrink(food) ? 'drink' : mealCategoryFor(new Date()));
  const { perServing, unit, amount, valid } = how;
  const preset = food.presetId ? getCommonFood(food.presetId) : null;
  const preview = valid
    ? calculateLogged(
        food.nutrients,
        food.basis,
        perServing ? { servings: amount } : { quantity: amount, unit: unit as 'g' | 'ml' },
      )
    : null;
  const approximate = food.dataSource === 'user_approximate';
  const g = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${roundForDisplay(v, 'g')} g`);

  const log = async () => {
    if (!valid) return;
    const entry = await safely(`log ${food.name}`, async () => {
      const target =
        saved ??
        (presetFromParams
          ? await savePresetFood(db, presetFromParams)
          : await saveProductFood(db, { barcode: params.barcode || null, draft: draft! }));
      if (keepTile && category === 'snack') await setInSnacksRow(db, target.id, true);
      if (keepTile && category === 'drink') await setInDrinksRow(db, target.id, true);
      if (!saved && favourite) await setFoodFavourite(db, target.id, true);
      if (!saved || keepTile || favourite) nutritionEvents.emit({ type: 'changed' });
      return logAndAnnounce(db, { kind: 'food', id: target.id }, amount, category);
    });
    if (entry) router.dismissAll();
  };

  const starred = favourite ?? saved?.isFavourite ?? false;
  const toggleStar = async () => {
    const next = !starred;
    setFavourite(next);
    if (saved) {
      await safely(`update ${food.name}`, () => setFoodFavourite(db, saved.id, next));
      nutritionEvents.emit({ type: 'changed' });
    }
  };
  const kcalText = preview ? `${approximate ? '≈ ' : ''}${roundForDisplay(preview.kcal, 'kcal')}` : '—';
  const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : roundForDisplay(v, 'g'));

  return (
    <ModalScreen
      title={food.name}
      onClose={() => router.back()}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color="text2" style={{ textAlign: 'center' }}>
            {`Adding to ${MEAL_LABELS[category]}`}
          </Text>
          <TourTarget id="product-log">
            <Button
              label={valid && preview ? `Log ${amountLabel(amount, unit)} · ${kcalText} kcal` : 'Log'}
              disabled={!valid}
              onPress={log}
              haptic
            />
          </TourTarget>
        </View>
      }>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        {food.imageUrl ? (
          <Image
            source={{ uri: food.imageUrl }}
            accessibilityLabel={`${food.name} picture`}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={150}
            style={{ width: 180, height: 180, borderRadius: radii.hero, backgroundColor: '#FFFFFF' }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" style={{ fontSize: 24, lineHeight: 30, fontFamily: fonts.bold }}>
              {food.name}
            </Text>
            {food.brand ? (
              <Text variant="callout" color="text2">
                {food.brand}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Favourite"
            accessibilityState={{ selected: starred }}
            onPress={() => void toggleStar()}
            hitSlop={6}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <StarIcon color={starred ? colors.kcal : colors.text2} filled={starred} size={22} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
          <BigNumber value={kcalText} label="Calories" color="kcal" />
          <BigNumber value={preview ? n(preview.proteinG) : '—'} unit="g" label="Protein" color="pro" />
          <BigNumber value={preview ? n(preview.carbsG) : '—'} unit="g" label="Carbs" />
          <BigNumber value={preview ? n(preview.fatG) : '—'} unit="g" label="Fat" />
        </View>
      </View>

      {food.health ? <HealthCard info={food.health} /> : null}

      <ListGroup
        title={perServing ? 'Servings' : 'How much?'}
        footer={
          perServing
            ? undefined
            : `Per 100 ${unit}: ${kcalLabel(food.nutrients, approximate)} · ${g(food.nutrients.proteinG)} protein · ${g(food.nutrients.carbsG)} carbs · ${g(food.nutrients.fatG)} fat${preset ? ' (typical values)' : ''}`
        }>
        <AmountPicker food={food} state={how} />
      </ListGroup>

      <ListGroup title="Meal">
        <View style={{ padding: spacing.md }}>
          <Segmented
            accessibilityLabel="Meal"
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map((c) => ({ value: c, label: MEAL_LABELS[c] }))}
          />
        </View>
        {(category === 'snack' && !alreadyTile.snack) || (category === 'drink' && !alreadyTile.drink) ? (
          <ListRow label={category === 'drink' ? 'Add to Drinks' : 'Add to Snacks'}>
            <Switch
              accessibilityLabel={category === 'drink' ? 'Add to Drinks' : 'Add to Snacks'}
              value={keepTile}
              onValueChange={setKeepTile}
              trackColor={{ true: colors.pro, false: colors.well }}
              thumbColor="#FFFFFF"
            />
          </ListRow>
        ) : null}
      </ListGroup>
    </ModalScreen>
  );
}
