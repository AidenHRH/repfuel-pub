import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ListGroup } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { saveMealDbRecipe } from '@/database/repositories/mealdbRepository';
import { estimate } from '@/domain/mealdbMatch';
import { nutritionEvents } from '@/features/nutrition/events';
import { RecipePhoto } from '@/features/recipes/RecipePhoto';
import { safely } from '@/features/safely';
import { getMealDb, type MealDbLookup } from '@/services/mealdb';
import { fonts, spacing } from '@/theme/tokens';

const n = (x: number | null) => (x === null ? '—' : Math.round(x).toLocaleString('en-GB'));

/** TheMealDB doesn't say how many a recipe serves; most are written for four. */
const DEFAULT_SERVES = 4;

/**
 * A recipe from TheMealDB: its photo (until the owner adds one), ingredients and amounts as written, its method as
 * steps, estimated macros with what couldn't be counted, and Save to my meals.
 */
export default function OnlineRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const router = useRouter();
  const [result, setResult] = useState<MealDbLookup | null>(null);
  const [serves, setServes] = useState(DEFAULT_SERVES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMealDb()
      .getMeal(id)
      .then((r) => !cancelled && setResult(r));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!result || result.status !== 'ok') {
    return (
      <ModalScreen title="Recipe" onClose={() => router.back()}>
        <Text color="text2">
          {!result
            ? 'Loading…'
            : result.status === 'not_found'
              ? 'TheMealDB doesn’t have this recipe any more.'
              : 'Can’t reach TheMealDB right now'}
        </Text>
      </ModalScreen>
    );
  }

  const meal = result.meal;
  const est = estimate(meal.ingredients);
  const per = (x: number | null) => (x === null ? null : x / serves);
  const about = `About ${n(per(est.nutrients.kcal))} kcal and ${n(per(est.nutrients.proteinG))} g protein a portion`;

  const save = async () => {
    setSaving(true);
    const recipe = await safely('save this meal', () => saveMealDbRecipe(db, meal, serves));
    setSaving(false);
    if (!recipe) return;
    nutritionEvents.emit({ type: 'changed' });
    router.replace(`/recipe/${recipe.id}`);
  };

  return (
    <ModalScreen
      title={meal.name}
      onClose={() => router.back()}
      footer={<Button label={saving ? 'Saving…' : 'Save to my meals'} disabled={saving} onPress={() => void save()} />}>
      <RecipePhoto photoRef={`mealdb:${meal.id}`} name={meal.name} fallback={meal.thumb} />

      <Text variant="callout" color="text2">
        {[meal.area, meal.category, 'from TheMealDB'].filter(Boolean).join(' · ')}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: fonts.medium }}>Serves</Text>
        <Button
          variant="secondary"
          label="−"
          accessibilityLabel="Fewer portions"
          disabled={serves <= 1}
          onPress={() => setServes(serves - 1)}
          style={{ paddingHorizontal: spacing.md }}
        />
        <Text numeric style={{ minWidth: 40, textAlign: 'center' }}>
          {String(serves)}
        </Text>
        <Button
          variant="secondary"
          label="+"
          accessibilityLabel="More portions"
          onPress={() => setServes(serves + 1)}
          style={{ paddingHorizontal: spacing.md }}
        />
      </View>

      <View accessible accessibilityLabel={about} style={{ gap: 2 }}>
        <Text variant="headline" numeric>
          {`≈ ${n(per(est.nutrients.kcal))} kcal · ${n(per(est.nutrients.proteinG))} g protein`}
        </Text>
        <Text variant="caption" color="text2" numeric>
          {`≈ ${n(per(est.nutrients.carbsG))} g carbs · ${n(per(est.nutrients.fatG))} g fat a portion, estimated from typical values`}
        </Text>
        {est.notCounted.length ? (
          <Text variant="caption" color="text2">
            {`Not counted: ${est.notCounted.join(', ')}. Save it and scan or pick these for exact macros.`}
          </Text>
        ) : null}
      </View>

      <ListGroup title="Ingredients · as written">
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {meal.ingredients.map((ing, i) => (
            <Text key={i}>{`${ing.measure} ${ing.name}`.trim()}</Text>
          ))}
        </View>
      </ListGroup>

      <ListGroup title="Steps">
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {meal.steps.map((step, i) => (
            <View key={i} accessibilityLabel={`Step ${i + 1}`} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Text color="text2" numeric>{`${i + 1}.`}</Text>
              <Text style={{ flex: 1 }}>{step}</Text>
            </View>
          ))}
        </View>
      </ListGroup>
    </ModalScreen>
  );
}
