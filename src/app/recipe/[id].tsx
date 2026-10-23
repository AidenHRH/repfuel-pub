import { useLocalSearchParams } from 'expo-router';

import { RecipeEditor } from '@/features/nutrition/RecipeEditor';

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecipeEditor recipeId={id} />;
}
