import type { HealthInfo } from './health';

export type UserProfile = {
  id: string;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  bodyFatPercentage: number | null;
  /** Consumer scales and visual guesses are estimates, and the UI says so. */
  bodyFatIsEstimate: boolean;
  primaryGoal: string;
  createdAt: string;
  updatedAt: string;
};

export type NutritionTargets = {
  id: string;
  caloriesKcal: number;
  proteinGrams: number;
  carbohydratesGrams: number | null;
  fatGrams: number | null;
  effectiveFrom: string;
  updatedAt: string;
};

/** Nutrient amounts. `null` means unknown — never treat it as zero. */
export type Nutrients = {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
  /** Secondary, shown when known. Optional: older snapshots and hand-made values don't have it (absent = unknown). */
  sugarG?: number | null;
};

export type NutritionBasis = 'per_serving' | 'per_100g' | 'per_100ml';

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';

export type DataSource = 'open_food_facts' | 'manual' | 'user_approximate' | 'card_scan';

export type FoodProduct = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  basis: NutritionBasis;
  servingSize: number | null;
  servingUnit: string | null;
  /** The whole pack (a 300 g bag), in g or ml like the nutrients; null when unknown. */
  packSize: number | null;
  /** Per serving or per 100 g/ml, according to `basis`. */
  nutrients: Nutrients;
  dataSource: DataSource;
  isFavourite: boolean;
  notes: string | null;
  /** A picture of the pack, for foods from Open Food Facts. */
  imageUrl: string | null;
  /** The built-in common food it was saved from, if any (e.g. "blueberries"). */
  presetId: string | null;
  /** Nutri-Score, processing and additives, for products from Open Food Facts. */
  health: HealthInfo | null;
  /** The shop it's from ("Aldi"), when known; never required. */
  shop: string | null;
  /** One piece (a Malteser) in g or ml, and what to call it, for logging by the piece; null until asked. */
  pieceG: number | null;
  pieceLabel: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredient = { id: string; recipeId: string; sortOrder: number } & (
  | { kind: 'food'; foodId: string; amount: number; unit: 'g' | 'ml' | 'serving' }
  | { kind: 'recipe'; subRecipeId: string; portions: number }
);

export type Recipe = {
  id: string;
  name: string;
  /** How many shares the whole batch gives (the owner's estimate, no weighing). */
  portionsMade: number;
  notes: string | null;
  isFavourite: boolean;
  deletedAt: string | null;
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
};

export type LogUnit = 'g' | 'ml' | 'serving' | 'portion';

export type FoodLogEntry = {
  id: string;
  foodId: string | null;
  recipeId: string | null;
  name: string;
  amount: number;
  unit: LogUnit;
  /** Snapshot for the amount eaten; never re-read from the source. */
  nutrients: Nutrients;
  isApproximate: boolean;
  loggedAt: string;
  localDay: string;
  mealCategory: MealCategory;
  notes: string | null;
  /** The food's photo (pack, built-in or the owner's), when the diary shows it; not stored on the entry. */
  photo?: string;
};

/** Something the owner can log in one tap. `nutrients` are for `defaultAmount`. */
export type Loggable = {
  kind: 'food' | 'recipe';
  id: string;
  name: string;
  defaultAmount: number;
  unit: LogUnit;
  nutrients: Nutrients;
  isApproximate: boolean;
  isFavourite: boolean;
};
