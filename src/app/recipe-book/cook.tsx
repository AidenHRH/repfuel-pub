import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ModalScreen } from '@/components/ModalScreen';
import { Text } from '@/components/Text';
import { getMealTemplate } from '@/domain/mealTemplates';
import { ingredientLines } from '@/domain/recipeView';
import { IngredientChip } from '@/features/recipes/IngredientChip';
import { spacing } from '@/theme/tokens';

/** Cook mode: one step at a time in large text, with that step's ingredients; the screen stays on. */
export default function CookScreen() {
  useKeepAwake();
  const params = useLocalSearchParams<{ id: string; portions?: string }>();
  const router = useRouter();
  const recipe = getMealTemplate(params.id);
  const [index, setIndex] = useState(0);
  if (!recipe) return null;

  const portions = Number(params.portions) > 0 ? Number(params.portions) : recipe.serves;
  const byFood = new Map(ingredientLines(recipe, portions).map((l) => [l.food, l]));
  const step = recipe.steps[index];
  const last = index === recipe.steps.length - 1;

  return (
    <ModalScreen
      title={recipe.name}
      closeLabel="Close"
      onClose={() => router.back()}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            variant="secondary"
            label="Back"
            accessibilityLabel="Previous step"
            disabled={index === 0}
            onPress={() => setIndex(index - 1)}
            style={{ flex: 1 }}
          />
          <Button
            label={last ? 'Done' : 'Next'}
            accessibilityLabel={last ? 'Done' : 'Next step'}
            onPress={() => (last ? router.back() : setIndex(index + 1))}
            style={{ flex: 2 }}
            haptic
          />
        </View>
      }>
      <Text variant="overline" color="text2">{`Step ${index + 1} of ${recipe.steps.length}`}</Text>
      <Text variant="title" style={{ fontSize: 26, lineHeight: 34 }}>
        {step.text}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {step.uses.map((food) => {
          const line = byFood.get(food);
          return line ? <IngredientChip key={food} line={line} /> : null;
        })}
      </View>
      {step.minutes ? (
        <Text variant="headline" color="text2">
          {`About ${step.minutes} min`}
        </Text>
      ) : null}
    </ModalScreen>
  );
}
