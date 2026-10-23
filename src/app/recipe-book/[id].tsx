import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { BigNumber } from '@/components/BigNumber';
import { Button } from '@/components/Button';
import { ListGroup } from '@/components/ListGroup';
import { ModalScreen } from '@/components/ModalScreen';
import { Text } from '@/components/Text';
import { portionCount } from '@/domain/format';
import { MEAL_LABELS } from '@/domain/meals';
import { storageAdvice } from '@/domain/mealPrep';
import { getMealTemplate, recipeTime, templateNutrients } from '@/domain/mealTemplates';
import { roundForDisplay } from '@/domain/nutrition';
import { ingredientLines } from '@/domain/recipeView';
import { IngredientChip } from '@/features/recipes/IngredientChip';
import { RecipePhoto } from '@/features/recipes/RecipePhoto';
import { spacing } from '@/theme/tokens';

const g = (v: number | null) => (v === null ? '—' : roundForDisplay(v, 'g'));

/**
 * A recipe from the recipe book: the owner's photo, times, macros per portion, ingredients for `portions`, steps
 * with the ingredients each uses highlighted, how to store it, and Cook mode.
 */
export default function RecipeScreen() {
  const params = useLocalSearchParams<{ id: string; portions?: string }>();
  const router = useRouter();
  const recipe = getMealTemplate(params.id);
  const ref = `template:${params.id}`;
  const portions = Number(params.portions) > 0 ? Number(params.portions) : (recipe?.serves ?? 1);
  if (!recipe) {
    return (
      <ModalScreen title="Recipe" onClose={() => router.back()}>
        <Text color="text2">This recipe isn’t in the book any more.</Text>
      </ModalScreen>
    );
  }

  const per = templateNutrients(recipe);
  const lines = ingredientLines(recipe, portions);
  const byFood = new Map(lines.map((l) => [l.food, l]));

  return (
    <ModalScreen
      title={recipe.name}
      onClose={() => router.back()}
      footer={
        <Button
          label="Cook"
          onPress={() => router.push({ pathname: '/recipe-book/cook', params: { id: recipe.id, portions: String(portions) } })}
        />
      }>
      <RecipePhoto photoRef={ref} name={recipe.name} />

      <View style={{ gap: 2 }}>
        <Text variant="callout" color="text2">
          {`${MEAL_LABELS[recipe.slot]} · the method makes ${portionCount(recipe.serves)} portion${recipe.serves === 1 ? '' : 's'}`}
        </Text>
        <Text variant="callout" color="text2">
          {recipeTime(recipe)}
        </Text>
      </View>

      <View
        accessible
        accessibilityLabel={`Per portion: ${per.kcal === null ? 'unknown' : Math.round(per.kcal)} kcal, ${g(per.proteinG)} g protein, ${g(per.carbsG)} g carbs, ${g(per.fatG)} g fat`}
        style={{ flexDirection: 'row', gap: spacing.sm }}>
        <BigNumber value={per.kcal === null ? '—' : String(Math.round(per.kcal))} label="Calories" color="kcal" />
        <BigNumber value={g(per.proteinG)} unit="g" label="Protein" color="pro" />
        <BigNumber value={g(per.carbsG)} unit="g" label="Carbs" />
        <BigNumber value={g(per.fatG)} unit="g" label="Fat" />
      </View>
      <Text variant="caption" color="text2" style={{ paddingHorizontal: spacing.xs }}>
        Per portion, worked out from each ingredient’s typical values.
      </Text>

      <ListGroup title={`Ingredients · ${portionCount(portions)} portion${portions === 1 ? '' : 's'}`}>
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {lines.map((l) => (
            <View
              key={l.food}
              accessible
              accessibilityLabel={`${l.name}, ${l.amount}`}
              style={{ flexDirection: 'row', gap: spacing.md }}>
              <Text numeric style={{ width: 64, textAlign: 'right' }}>
                {l.amount}
              </Text>
              <Text style={{ flex: 1 }}>
                {l.name}
                {l.note ? <Text color="text2">{`, ${l.note}`}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      </ListGroup>

      <ListGroup title="Steps">
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {recipe.steps.map((step, i) => (
            <View key={i} accessibilityLabel={`Step ${i + 1}`} style={{ gap: spacing.sm }}>
              <Text>{`${i + 1}. ${step.text}`}</Text>
              {step.uses.length || step.minutes ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {step.uses.map((food) => {
                    const line = byFood.get(food);
                    return line ? <IngredientChip key={food} line={line} /> : null;
                  })}
                  {step.minutes ? (
                    <Text variant="caption" color="text2" style={{ alignSelf: 'center' }}>
                      {`${step.minutes} min`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ListGroup>

      <ListGroup title="Keeping it">
        <Text style={{ padding: spacing.lg }}>{storageAdvice(recipe)}</Text>
      </ListGroup>
    </ModalScreen>
  );
}
