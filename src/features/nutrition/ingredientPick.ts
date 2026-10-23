/**
 * Hands a food scanned (or checked) for a meal back to the meal being built. The meal screen listens while open;
 * the scan screen, opened with `for=ingredient`, calls `pickIngredient` and goes back.
 */
type Listener = (foodId: string) => void;

let listener: Listener | null = null;

export function onIngredientPicked(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

export function pickIngredient(foodId: string): void {
  listener?.(foodId);
}
