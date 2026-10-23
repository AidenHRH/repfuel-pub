import { createOpenFoodFactsProvider } from './food-provider/openFoodFacts';
import type { FoodProvider } from './food-provider/types';

let provider: FoodProvider | null = null;

/** The product database used for barcode lookups (Open Food Facts). */
export function getFoodProvider(): FoodProvider {
  provider ??= createOpenFoodFactsProvider();
  return provider;
}
