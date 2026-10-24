import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { FlameIcon } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import type { DaySummary } from '@/database/repositories/dayRepository';
import { dayTitle, WEEKDAY_LETTERS } from '@/domain/dates';
import { goalsHit } from '@/domain/dayStatus';
import { roundForDisplay, sumEntries } from '@/domain/nutrition';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { DayDot, STAGE_WORDS } from './DayDot';

type Props = {
  day: string;
  today: string;
  /** The weeks the picker offers, oldest first, seven days each (Monday first). */
  weeks: DaySummary[][];
  streak: number;
  onPick: (day: string) => void;
};

/** "Today ▾" with the streak, then the week's dots; the picker and the week view open from here. */
export function DayBar({ day, today, weeks, streak, onPick }: Props) {
  const { colors } = useTheme();
  const [sheet, setSheet] = useState<'pick' | 'week' | null>(null);
  const week = weeks.find((w) => w.some((s) => s.day === day)) ?? weeks[weeks.length - 1];
  const pick = (d: string) => {
    setSheet(null);
    onPick(d);
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose a day, showing ${dayTitle(day, today)}`}
          onPress={() => setSheet('pick')}
          hitSlop={8}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
          <Text variant="headline">{dayTitle(day, today)}</Text>
          <Text variant="caption" color="text2">
            ▾
          </Text>
        </Pressable>
        {streak > 0 ? (
          <View
            accessible
            accessibilityLabel={`${streak}-day streak`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              borderRadius: radii.pill,
              backgroundColor: colors.well,
            }}>
            <FlameIcon color={colors.accent} size={14} />
            <Text variant="caption" numeric style={{ fontFamily: fonts.semibold }}>
              {String(streak)}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {day !== today ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to today" hitSlop={8} onPress={() => onPick(today)}>
            <Text variant="callout" color="accent" style={{ fontFamily: fonts.semibold }}>
              ‹ Today
            </Text>
          </Pressable>
        ) : null}
      </View>

      {week ? (
        <View style={{ gap: spacing.xs }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Week view"
            accessibilityHint="Protein and calories for each day this week"
            onPress={() => setSheet('week')}
            hitSlop={6}
            style={{ alignSelf: 'flex-start' }}>
            <Text variant="overline" color="text2">
              {week.some((s) => s.day === today) ? 'This week ›' : `Week of ${dayTitle(week[0].day, today)} ›`}
            </Text>
          </Pressable>
          <DotRow week={week} day={day} today={today} onPick={pick} />
        </View>
      ) : null}

      <Sheet visible={sheet === 'pick'} title="Choose a day" closeLabel="Done" onClose={() => setSheet(null)}>
        <View style={{ gap: spacing.md }}>
          {weeks
            .slice()
            .reverse()
            .map((w) => (
              <DotRow key={w[0].day} week={w} day={day} today={today} onPick={pick} numbers />
            ))}
        </View>
      </Sheet>

      <Sheet visible={sheet === 'week'} title="Week view" closeLabel="Done" onClose={() => setSheet(null)}>
        {week ? <WeekView week={week} today={today} onPick={pick} /> : null}
      </Sheet>
    </View>
  );
}

function DotRow({
  week,
  day,
  today,
  onPick,
  numbers,
}: {
  week: DaySummary[];
  day: string;
  today: string;
  onPick: (day: string) => void;
  numbers?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {week.map((s, i) => {
        const future = s.day > today;
        const selected = s.day === day;
        return (
          <Pressable
            key={s.day}
            accessibilityRole="button"
            accessibilityLabel={`${dayTitle(s.day, today)}, ${STAGE_WORDS[s.status.stage]}`}
            accessibilityState={{ selected, disabled: future }}
            disabled={future}
            onPress={() => onPick(s.day)}
            style={({ pressed }) => ({
              alignItems: 'center',
              gap: 4,
              paddingVertical: 4,
              width: 40,
              borderRadius: radii.control,
              backgroundColor: selected ? colors.well : 'transparent',
              opacity: future ? 0.35 : pressed ? 0.6 : 1,
            })}>
            <Text variant="micro" color={s.day === today ? 'accent' : 'text2'} style={{ fontFamily: fonts.semibold }}>
              {numbers ? String(Number(s.day.slice(8))) : WEEKDAY_LETTERS[i]}
            </Text>
            <DayDot stage={s.status.stage} mealsDone={s.status.mealsDone} size={numbers ? 26 : 30} />
          </Pressable>
        );
      })}
    </View>
  );
}

function WeekView({ week, today, onPick }: { week: DaySummary[]; today: string; onPick: (day: string) => void }) {
  const { colors } = useTheme();
  const past = week.filter((s) => s.day <= today);
  const onTarget = past.filter((s) => goalsHit(s.entries, s.targets)).length;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text color="text2">{`${onTarget} of ${past.length} day${past.length === 1 ? '' : 's'} on target`}</Text>
      {past.length ? (
        <Text variant="caption" color="text2" numeric>
          {`Targets: ${past[past.length - 1].targets.proteinGrams} g protein · ${past[past.length - 1].targets.caloriesKcal.toLocaleString('en-GB')} kcal`}
        </Text>
      ) : null}
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
        {past.map((s, i) => {
          const { totals } = sumEntries(s.entries.map((e) => ({ ...e.nutrients, isApproximate: e.isApproximate })));
          const protein = roundForDisplay(totals.proteinG, 'g');
          const kcal = roundForDisplay(totals.kcal, 'kcal');
          return (
            <Pressable
              key={s.day}
              accessibilityRole="button"
              accessibilityLabel={`${dayTitle(s.day, today)}: protein ${protein} of ${s.targets.proteinGrams} grams, ${kcal} of ${s.targets.caloriesKcal.toLocaleString('en-GB')} calories`}
              onPress={() => onPick(s.day)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.sep,
                backgroundColor: pressed ? colors.well : colors.card,
              })}>
              <DayDot stage={s.status.stage} mealsDone={s.status.mealsDone} size={22} />
              <Text style={{ flex: 1, fontFamily: fonts.medium }} numberOfLines={1}>
                {dayTitle(s.day, today)}
              </Text>
              <Text variant="callout" color="pro" numeric style={{ fontFamily: fonts.semibold }}>
                {`${protein} g`}
              </Text>
              <Text variant="callout" color="text2" numeric style={{ minWidth: 84, textAlign: 'right' }}>
                {`${kcal} kcal`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
