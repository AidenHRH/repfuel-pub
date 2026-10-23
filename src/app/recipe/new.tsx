import { useLocalSearchParams } from 'expo-router';

import { RecipeEditor } from '@/features/nutrition/RecipeEditor';

export default function NewRecipeScreen() {
  // `now=1`: Build a meal from Log food — log what's on the plate straight away.
  const { now, meal } = useLocalSearchParams<{ now?: string; meal?: string }>();
  return <RecipeEditor now={now === '1'} meal={meal} />;
}
