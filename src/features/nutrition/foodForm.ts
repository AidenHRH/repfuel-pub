import type { NewFood } from '@/database/repositories/foodRepository';
import { parseAmount } from '@/domain/parse';
import type { FoodProduct, Nutrients, NutritionBasis } from '@/domain/types';
import type { FoodDraft } from '@/services/food-provider/types';

export type FoodFormValues = {
  name: string;
  brand: string;
  basis: NutritionBasis;
  servingSize: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  sugar: string;
  approximate: boolean;
};

export type FoodFormErrors = Partial<Record<keyof FoodFormValues, string>>;

export function emptyFoodForm(overrides: Partial<FoodFormValues> = {}): FoodFormValues {
  return {
    name: '',
    brand: '',
    basis: 'per_serving',
    servingSize: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
    fibre: '',
    sugar: '',
    approximate: false,
    ...overrides,
  };
}

/**
 * The update to save when the owner edits a food: the form's fields only, so a scanned food keeps its
 * barcode and notes. Changing nutrition or basis makes the values the owner's own ('manual').
 */
export function editedFood(original: FoodProduct, fromForm: NewFood): Partial<NewFood> {
  const sameNutrition =
    original.basis === fromForm.basis &&
    (Object.keys(NUTRIENT_LABELS) as (keyof Nutrients)[]).every(
      (k) => (original.nutrients[k] ?? null) === (fromForm.nutrients[k] ?? null),
    );
  // Unchanged values keep their source (e.g. Open Food Facts); edited ones become the owner's own.
  const dataSource =
    fromForm.dataSource === 'user_approximate'
      ? 'user_approximate'
      : sameNutrition && original.dataSource !== 'user_approximate'
        ? original.dataSource
        : 'manual';
  return {
    name: fromForm.name,
    brand: fromForm.brand,
    basis: fromForm.basis,
    servingSize: fromForm.servingSize,
    servingUnit: fromForm.servingUnit,
    nutrients: fromForm.nutrients,
    dataSource,
  };
}

const text = (n: number | null) => (n === null ? '' : String(n));

export function formFromFood(food: FoodProduct): FoodFormValues {
  return {
    name: food.name,
    brand: food.brand ?? '',
    basis: food.basis,
    servingSize: text(food.servingSize),
    kcal: text(food.nutrients.kcal),
    protein: text(food.nutrients.proteinG),
    carbs: text(food.nutrients.carbsG),
    fat: text(food.nutrients.fatG),
    fibre: text(food.nutrients.fibreG),
    sugar: text(food.nutrients.sugarG ?? null),
    approximate: food.dataSource === 'user_approximate',
  };
}

/**
 * Turns form text into a food. Calories and protein are required; other nutrients may be
 * left blank and stay unknown. Anything typed that isn't a number is an error, never zero.
 */
export function validateFoodForm(values: FoodFormValues): { ok: true; food: NewFood } | { ok: false; errors: FoodFormErrors } {
  const errors: FoodFormErrors = {};
  if (!values.name.trim()) errors.name = 'Give it a name';

  const read = (key: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'sugar' | 'servingSize', required: boolean) => {
    const parsed = parseAmount(values[key]);
    if (parsed === null) {
      if (required) errors[key] = 'Required';
      return null;
    }
    if (Number.isNaN(parsed)) {
      errors[key] = 'Enter a number';
      return null;
    }
    return parsed;
  };

  const kcal = read('kcal', true);
  const proteinG = read('protein', true);
  const carbsG = read('carbs', false);
  const fatG = read('fat', false);
  const fibreG = read('fibre', false);
  const sugarG = read('sugar', false);
  const servingSize = read('servingSize', false);
  if (servingSize === 0) errors.servingSize = 'Enter a size above 0';

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    food: {
      name: values.name.trim(),
      brand: values.brand.trim() || null,
      barcode: null,
      basis: values.basis,
      servingSize,
      servingUnit: servingSize === null ? null : values.basis === 'per_100ml' ? 'ml' : 'g',
      nutrients: { kcal, proteinG, carbsG, fatG, fibreG, sugarG },
      dataSource: values.approximate ? 'user_approximate' : 'manual',
      notes: null,
    },
  };
}

const NUTRIENT_LABELS: Record<keyof Nutrients, string> = {
  kcal: 'calories',
  proteinG: 'protein',
  carbsG: 'carbs',
  fatG: 'fat',
  fibreG: 'fibre',
  sugarG: 'sugar',
};

/** Form values prefilled from a barcode lookup; anything the database didn't list stays blank. */
export function formFromDraft(draft: FoodDraft): FoodFormValues {
  return emptyFoodForm({
    name: draft.name ?? '',
    brand: draft.brand ?? '',
    basis: draft.basis,
    servingSize: text(draft.servingSize),
    kcal: text(draft.nutrients.kcal),
    protein: text(draft.nutrients.proteinG),
    carbs: text(draft.nutrients.carbsG),
    fat: text(draft.nutrients.fatG),
    fibre: text(draft.nutrients.fibreG),
    sugar: text(draft.nutrients.sugarG ?? null),
  });
}

/** "carbs, fibre" for the hint under a looked-up product. */
export function missingLabel(missing: (keyof Nutrients)[]): string {
  return missing.map((k) => NUTRIENT_LABELS[k]).join(', ');
}

/** Calories and protein must be filled in; the rest may stay unknown. */
export function splitMissing(missing: (keyof Nutrients)[]): { required: (keyof Nutrients)[]; optional: (keyof Nutrients)[] } {
  return {
    required: missing.filter((k) => k === 'kcal' || k === 'proteinG'),
    optional: missing.filter((k) => k !== 'kcal' && k !== 'proteinG'),
  };
}

/** Values exactly as looked up keep the database as their source; anything the owner changed or added is theirs. */
export function sourceForScanned(draft: FoodDraft, food: NewFood): NewFood['dataSource'] {
  if (food.dataSource === 'user_approximate') return 'user_approximate';
  const same = draft.basis === food.basis && JSON.stringify(draft.nutrients) === JSON.stringify(food.nutrients);
  return same ? 'open_food_facts' : 'manual';
}
