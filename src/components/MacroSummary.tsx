import { View } from 'react-native';

import { roundForDisplay, type DayTotals } from '@/domain/nutrition';
import type { NutritionTargets } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

import { Card } from './Card';
import { ProgressRing } from './ProgressRing';
import { Text } from './Text';

type Props = { totals: DayTotals; targets: NutritionTargets };

/** Today's hero card: calorie and protein rings with consumed, target and remaining. */
export function MacroSummary({ totals, targets }: Props) {
  const { colors } = useTheme();
  const { kcal, proteinG, carbsG, fatG } = totals.totals;
  const approx = totals.approximate ? '≈ ' : '';
  const kcalLeft = targets.caloriesKcal - kcal;
  const proteinLeft = targets.proteinGrams - proteinG;

  const notes: string[] = [];
  if (totals.approximate) notes.push('≈ includes your estimates');
  if (totals.incomplete.kcal || totals.incomplete.proteinG) notes.push('Some calories or protein unknown');
  if (totals.incomplete.carbsG || totals.incomplete.fatG) notes.push('Carbs/fat incomplete: some values unknown');

  const ringLabel = `Calories ${roundForDisplay(kcal, 'kcal')} of ${roundForDisplay(targets.caloriesKcal, 'kcal')}. Protein ${roundForDisplay(proteinG, 'g')} of ${roundForDisplay(targets.proteinGrams, 'g')} grams.`;

  return (
    <Card hero style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
        <ProgressRing
          outer={{ progress: kcal / targets.caloriesKcal, color: colors.ringKcal }}
          inner={{ progress: proteinG / targets.proteinGrams, color: colors.ringPro }}
          accessibilityLabel={ringLabel}
        />
        <View style={{ flex: 1, gap: spacing.lg }}>
          <Metric
            label="Calories"
            value={`${approx}${roundForDisplay(kcal, 'kcal')}`}
            target={`/ ${roundForDisplay(targets.caloriesKcal, 'kcal')}`}
            color="kcal"
            remaining={kcalLeft >= 0 ? `${roundForDisplay(kcalLeft, 'kcal')} kcal left` : `${roundForDisplay(-kcalLeft, 'kcal')} kcal over`}
          />
          <Metric
            label="Protein"
            value={`${approx}${roundForDisplay(proteinG, 'g')}`}
            target={`/ ${roundForDisplay(targets.proteinGrams, 'g')} g`}
            color="pro"
            remaining={proteinLeft > 0 ? `${roundForDisplay(proteinLeft, 'g')} g to go` : 'Target reached'}
          />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.sep }} />
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', gap: spacing.xxl }}>
          <Text variant="callout" color="text2" numeric>
            Carbs{' '}
            <Text variant="callout" numeric>
              {roundForDisplay(carbsG, 'g')} g
            </Text>
          </Text>
          <Text variant="callout" color="text2" numeric>
            Fat{' '}
            <Text variant="callout" numeric>
              {roundForDisplay(fatG, 'g')} g
            </Text>
          </Text>
        </View>
        {notes.length ? (
          <Text variant="caption" color="text2">
            {notes.join(' · ')}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function Metric(props: { label: string; value: string; target: string; remaining: string; color: 'kcal' | 'pro' }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" color="text2">
        {props.label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text variant="title" color={props.color} numeric style={{ fontSize: 24, lineHeight: 30 }}>
          {props.value}
        </Text>
        <Text variant="callout" color="text2" numeric>
          {' '}
          {props.target}
        </Text>
      </View>
      <Text variant="caption" color="text2" numeric>
        {props.remaining}
      </Text>
    </View>
  );
}
