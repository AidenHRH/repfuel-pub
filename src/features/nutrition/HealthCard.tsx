import { View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { healthVerdict, NOVA_LABELS, VERDICT_LABELS, type HealthInfo, type NutriScore } from '@/domain/health';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, health as healthColors, radii, spacing } from '@/theme/tokens';

const GRADES: NutriScore[] = ['a', 'b', 'c', 'd', 'e'];

/** A product's health at a glance: Good / Okay / Poor and why (Nutri-Score, processing, additives). */
export function HealthCard({ info }: { info: HealthInfo }) {
  const { colors } = useTheme();
  const result = healthVerdict(info);
  return (
    <Card accessibilityLabel="Health" style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="headline">Health</Text>
        {result ? (
          <View
            accessibilityLabel={`Rated ${VERDICT_LABELS[result.verdict]}`}
            style={{
              backgroundColor: healthColors.verdict[result.verdict],
              borderRadius: radii.pill,
              paddingHorizontal: spacing.md,
              paddingVertical: 4,
            }}>
            <Text variant="callout" style={{ color: '#FFFFFF', fontFamily: fonts.semibold }}>
              {VERDICT_LABELS[result.verdict]}
            </Text>
          </View>
        ) : (
          <Text variant="caption" color="text2">
            Not enough information to rate
          </Text>
        )}
      </View>

      {info.nutriscore ? (
        <View style={{ gap: spacing.xs }}>
          <View accessibilityLabel={`Nutri-Score ${info.nutriscore.toUpperCase()}`} style={{ flexDirection: 'row', gap: 4 }}>
            {GRADES.map((g) => {
              const on = g === info.nutriscore;
              return (
                <View
                  key={g}
                  style={{
                    flex: on ? 1.4 : 1,
                    height: on ? 40 : 30,
                    alignSelf: 'center',
                    borderRadius: 8,
                    backgroundColor: healthColors.nutriscore[g],
                    opacity: on ? 1 : 0.35,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ color: healthColors.nutriscoreText[g], fontFamily: fonts.bold, fontSize: on ? 20 : 15 }}>
                    {g.toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        {result
          ? result.reasons.map((r) => (
              <Text key={r} variant="callout" color="text2">
                {`• ${r}`}
              </Text>
            ))
          : null}
        {!result && info.nova ? (
          <Text variant="callout" color="text2">{`• ${NOVA_LABELS[info.nova]} (NOVA ${info.nova})`}</Text>
        ) : null}
        <Text variant="caption" color="text2">
          {info.additives.length ? `Additives: ${info.additives.join(', ')}` : 'No additives listed'}
        </Text>
      </View>
      <Text variant="caption" color="text2" style={{ borderTopWidth: 1, borderTopColor: colors.sep, paddingTop: spacing.sm }}>
        From Open Food Facts. Nutri-Score rates the nutrition per 100 g; NOVA says how processed it is.
      </Text>
    </Card>
  );
}

/** The small Nutri-Score letter shown beside a product in lists. */
export function NutriScoreBadge({ grade }: { grade: NutriScore }) {
  return (
    <View
      accessibilityLabel={`Nutri-Score ${grade.toUpperCase()}`}
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        backgroundColor: healthColors.nutriscore[grade],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: healthColors.nutriscoreText[grade], fontFamily: fonts.bold, fontSize: 14 }}>
        {grade.toUpperCase()}
      </Text>
    </View>
  );
}
