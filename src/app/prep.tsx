import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { CheckRow } from '@/components/CheckRow';
import { EmptyState } from '@/components/EmptyState';
import { NutritionIcon } from '@/components/icons';
import { ModalScreen } from '@/components/ModalScreen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { planDayKeys, prepFor, prepTicks, setPrepTicks } from '@/database/repositories/mealPlanRepository';
import type { PrepSession } from '@/domain/mealPrep';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

type Span = '2' | '3' | '5';

/** Meal prep: one cooking session for the next few days of the plan, step by step, then which box is which. */
export default function PrepScreen() {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [span, setSpan] = useState<Span>('3');
  const [session, setSession] = useState<PrepSession | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  // Prep today for the days from tomorrow.
  const { today, days } = useMemo(() => {
    const all = planDayKeys(new Date(), Number(span) + 1);
    return { today: all[0], days: all.slice(1) };
  }, [span]);
  const sessionKey = `${days[0]}+${days.length}`;

  useEffect(() => {
    let cancelled = false;
    Promise.all([prepFor(db, days, today), prepTicks(db, sessionKey)])
      .then(([s, ticks]) => {
        if (cancelled) return;
        setSession(s);
        setDone(ticks);
      })
      .catch(() => {
        if (!cancelled) setSession({ steps: [], boxes: [], madeOnTheDay: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [db, days, today, sessionKey]);

  const toggle = (key: string) => {
    const next = new Set(done);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDone(next);
    setPrepTicks(db, sessionKey, next).catch(() => undefined);
  };

  const group = (title: string, children: React.ReactNode) => (
    <View style={{ gap: spacing.sm }}>
      <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>{children}</View>
    </View>
  );

  const empty = session && session.steps.length === 0 && session.madeOnTheDay.length === 0;
  const stepsLeft = session ? session.steps.filter((s) => !done.has(s.key)).length : 0;

  return (
    <ModalScreen title="Meal prep" closeLabel="Done" onClose={() => router.back()}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="callout" color="text2">
          Cook once today for the days from tomorrow
        </Text>
        <Segmented
          accessibilityLabel="Prep for"
          value={span}
          onChange={setSpan}
          options={[
            { value: '2', label: '2 days' },
            { value: '3', label: '3 days' },
            { value: '5', label: '5 days' },
          ]}
        />
      </View>

      {empty ? (
        <EmptyState
          icon={<NutritionIcon color={colors.accent} />}
          title="Nothing planned to prep"
          message="Make a meal plan in Nutrition first. Lunches and dinners from it show up here as a cooking session."
        />
      ) : null}

      {session && session.steps.length > 0
        ? group(
            stepsLeft === 0 ? 'Steps · all done' : `Steps · ${stepsLeft} to go`,
            session.steps.map((s, i) => (
              <CheckRow
                key={s.key}
                first={i === 0}
                title={`${i + 1}. ${s.title}`}
                detail={s.detail}
                checked={done.has(s.key)}
                onToggle={() => toggle(s.key)}
              />
            )),
          )
        : null}

      {session && session.boxes.length > 0
        ? group(
            'Boxes',
            session.boxes.map((b, i) => (
              <CheckRow
                key={b.key}
                first={i === 0}
                title={b.name}
                accessibilityLabel={`${b.label}: ${b.name}, ${b.store === 'fridge' ? 'fridge' : 'freezer'}`}
                checked={done.has(`box:${b.key}`)}
                onToggle={() => toggle(`box:${b.key}`)}
                detail={
                  <View style={{ gap: 2 }}>
                    <Text variant="caption" color="accent">
                      {b.label}
                    </Text>
                    {b.contents ? (
                      <Text variant="caption" color="text2">
                        {b.contents}
                      </Text>
                    ) : null}
                    {b.onTheDay ? (
                      <Text variant="caption" color="text2">
                        {b.onTheDay}
                      </Text>
                    ) : null}
                  </View>
                }
                trailing={
                  <View
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: radii.pill,
                      backgroundColor: colors.well,
                    }}>
                    <Text variant="micro" color={b.store === 'fridge' ? 'text' : 'pro'} style={{ fontFamily: fonts.semibold }}>
                      {b.store === 'fridge' ? 'Fridge' : 'Freezer'}
                    </Text>
                  </View>
                }
              />
            )),
          )
        : null}

      {session && session.madeOnTheDay.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
            Made on the day
          </Text>
          <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
            {session.madeOnTheDay.map((m, i) => (
              <View
                key={m.key}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  gap: 2,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.sep,
                }}>
                <Text style={{ fontFamily: fonts.medium }}>{m.name}</Text>
                <Text variant="caption" color="text2">
                  {m.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {session && session.boxes.length > 0 ? (
        <Text variant="caption" color="text2">
          NHS advice: get cooked food in the fridge within 2 hours (rice within 1 hour), eat chilled leftovers within 2 days and
          cooked rice within 24 hours. Defrost freezer boxes in the fridge the night before and reheat until steaming hot all the
          way through. Reheat rice only once.
        </Text>
      ) : null}
    </ModalScreen>
  );
}
