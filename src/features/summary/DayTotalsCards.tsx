import { View } from 'react-native';

import { Text } from '@/components/Text';
import { roundForDisplay, type DayTotals } from '@/domain/nutrition';
import type { NutritionTargets } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

/** "Fibre 6 g · Sugar 12 g": the secondary nutrients, each only when some entry knows it. */
function secondary({ totals, known }: DayTotals): string[] {
  return [
    known.fibreG ? `Fibre ${roundForDisplay(totals.fibreG, 'g')} g` : null,
    known.sugarG ? `Sugar ${roundForDisplay(totals.sugarG, 'g')} g` : null,
  ].filter((x): x is string => x !== null);
}

function Bar({ share, color, height }: { share: number; color: string; height: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.well, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(1, share)) * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** The day's calories (eaten, target, left, a bar) and a card of protein, carbs and fat against their targets. */
export function DayTotalsCards({ totals, targets }: { totals: DayTotals; targets: NutritionTargets }) {
  const { colors } = useTheme();
  const { kcal, proteinG, carbsG, fatG } = totals.totals;
  const approx = totals.approximate ? '≈ ' : '';
  const left = targets.caloriesKcal - kcal;

  const notes: string[] = [];
  if (totals.approximate) notes.push('≈ includes your estimates');
  if (totals.incomplete.kcal || totals.incomplete.proteinG) notes.push('Some calories or protein unknown');
  if (totals.incomplete.carbsG || totals.incomplete.fatG) notes.push('Carbs/fat incomplete: some values unknown');

  const label = `Calories ${roundForDisplay(kcal, 'kcal')} of ${roundForDisplay(targets.caloriesKcal, 'kcal')}. Protein ${roundForDisplay(proteinG, 'g')} of ${roundForDisplay(targets.proteinGrams, 'g')} grams.`;

  const macros: { name: string; value: number; target: number | null; color: string }[] = [
    { name: 'Protein', value: proteinG, target: targets.proteinGrams, color: colors.pro },
    { name: 'Carbs', value: carbsG, target: targets.carbohydratesGrams, color: colors.text2 },
    { name: 'Fat', value: fatG, target: targets.fatGrams, color: colors.text2 },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      <View
        accessible
        accessibilityLabel={label}
        style={{ backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text variant="callout" color="text2">
            Calories
          </Text>
          <Text variant="callout" numeric>
            <Text variant="headline" numeric>
              {roundForDisplay(Math.abs(left), 'kcal')}
            </Text>
            {left >= 0 ? ' left' : ' over'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
          <Text numeric style={{ fontSize: 30, lineHeight: 36, fontFamily: fonts.bold, color: colors.kcal }}>
            {`${approx}${roundForDisplay(kcal, 'kcal')}`}
          </Text>
          <Text color="text2" numeric>{`/ ${roundForDisplay(targets.caloriesKcal, 'kcal')} kcal`}</Text>
        </View>
        <Bar share={kcal / targets.caloriesKcal} color={left >= 0 ? colors.kcal : colors.danger} height={10} />
      </View>

      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {macros.map((m) => (
            <View
              key={m.name}
              accessible
              accessibilityLabel={`${m.name} ${roundForDisplay(m.value, 'g')}${m.target ? ` of ${m.target}` : ''} grams`}
              style={{ flex: 1, gap: 4 }}>
              <Text variant="caption" color="text2">
                {m.name}
              </Text>
              <Text numeric>
                <Text variant="headline" numeric>
                  {roundForDisplay(m.value, 'g')}
                </Text>
                <Text variant="callout" color="text2" numeric>
                  {m.target ? ` / ${m.target} g` : ' g'}
                </Text>
              </Text>
              <Bar share={m.target ? m.value / m.target : 0} color={m.color} height={8} />
            </View>
          ))}
        </View>
        {secondary(totals).length ? (
          <Text variant="caption" color="text2" numeric>
            {secondary(totals).join(' · ')}
          </Text>
        ) : null}
        {notes.length ? (
          <Text variant="caption" color="text2">
            {notes.join(' · ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
