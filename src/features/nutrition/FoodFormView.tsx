import { Switch, View } from 'react-native';

import { ListGroup, ListRow } from '@/components/ListGroup';
import { Segmented } from '@/components/Segmented';
import { TextField } from '@/components/TextField';
import type { NutritionBasis } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import type { FoodFormErrors, FoodFormValues } from './foodForm';

type Props = {
  values: FoodFormValues;
  errors: FoodFormErrors;
  onChange: (values: FoodFormValues) => void;
  /** Quick meal: just name, calories, protein and optional carbs/fat per serving. */
  quick?: boolean;
};

const BASIS_OPTIONS: { value: NutritionBasis; label: string }[] = [
  { value: 'per_serving', label: 'Serving' },
  { value: 'per_100g', label: '100 g' },
  { value: 'per_100ml', label: '100 ml' },
];

export function FoodFormView({ values, errors, onChange, quick }: Props) {
  const { colors } = useTheme();
  const set =
    <K extends keyof FoodFormValues>(key: K) =>
    (value: FoodFormValues[K]) =>
      onChange({ ...values, [key]: value });
  const per = values.basis === 'per_serving' ? 'per serving' : values.basis === 'per_100g' ? 'per 100 g' : 'per 100 ml';
  const sizeUnit = values.basis === 'per_100ml' ? 'ml' : 'g';

  return (
    <>
      <ListGroup>
        <TextField
          label="Name"
          value={values.name}
          onChangeText={set('name')}
          placeholder="e.g. Gousto katsu curry"
          error={errors.name}
          autoFocus={!values.name}
        />
        {quick ? null : <TextField label="Brand" value={values.brand} onChangeText={set('brand')} placeholder="Optional" />}
      </ListGroup>

      {quick ? null : (
        <ListGroup title="Label shows nutrition per">
          <View style={{ padding: spacing.md }}>
            <Segmented
              accessibilityLabel="Nutrition basis"
              value={values.basis}
              onChange={set('basis')}
              options={BASIS_OPTIONS}
            />
          </View>
          <TextField
            label={values.basis === 'per_serving' ? 'Serving' : 'Usual amount'}
            value={values.servingSize}
            onChangeText={set('servingSize')}
            keyboardType="decimal-pad"
            placeholder="Optional"
            suffix={sizeUnit}
            error={errors.servingSize}
          />
        </ListGroup>
      )}

      <ListGroup
        title={`Nutrition ${per}`}
        footer="Leave anything you don't know blank. It stays unknown and is never counted as zero.">
        <TextField
          label="Calories"
          value={values.kcal}
          onChangeText={set('kcal')}
          keyboardType="decimal-pad"
          suffix="kcal"
          error={errors.kcal}
        />
        <TextField
          label="Protein"
          value={values.protein}
          onChangeText={set('protein')}
          keyboardType="decimal-pad"
          suffix="g"
          error={errors.protein}
        />
        <TextField
          label="Carbs"
          value={values.carbs}
          onChangeText={set('carbs')}
          keyboardType="decimal-pad"
          placeholder="Optional"
          suffix="g"
          error={errors.carbs}
        />
        <TextField
          label="Fat"
          value={values.fat}
          onChangeText={set('fat')}
          keyboardType="decimal-pad"
          placeholder="Optional"
          suffix="g"
          error={errors.fat}
        />
        {quick ? null : (
          <TextField
            label="Fibre"
            value={values.fibre}
            onChangeText={set('fibre')}
            keyboardType="decimal-pad"
            placeholder="Optional"
            suffix="g"
            error={errors.fibre}
          />
        )}
        {quick ? null : (
          <TextField
            label="Sugar"
            value={values.sugar}
            onChangeText={set('sugar')}
            keyboardType="decimal-pad"
            placeholder="Optional"
            suffix="g"
            error={errors.sugar}
          />
        )}
      </ListGroup>

      <ListGroup footer="Estimates are shown with ≈ wherever they count towards your totals.">
        <ListRow label="These are estimates">
          <Switch
            accessibilityLabel="These are estimates"
            value={values.approximate}
            onValueChange={set('approximate')}
            trackColor={{ true: colors.accent, false: colors.well }}
            thumbColor="#FFFFFF"
          />
        </ListRow>
      </ListGroup>
    </>
  );
}
