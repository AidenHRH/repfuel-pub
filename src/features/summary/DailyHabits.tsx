import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { WorkoutsIcon } from '@/components/icons';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { sessionBreaks, trainingFeed } from '@/database/repositories/trainingRepository';
import { durationLabel } from '@/domain/classes';
import { localDayKey, localTimeLabel } from '@/domain/dates';
import { groupSessions, type Session } from '@/domain/sessions';
import { itemAt } from '@/domain/training';
import { TodayReminder } from '@/features/reminders/TodayReminder';
import { TourTarget } from '@/features/tour/TourTarget';
import { workoutEvents } from '@/features/workouts/events';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

/** Creatine (today only) and the day's workout sessions, earliest first, each opening its sets. */
export function DailyHabits({ day, isToday }: { day: string; isToday: boolean }) {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => workoutEvents.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([trainingFeed(db, 200), sessionBreaks(db)]).then(
      ([items, breaks]) => {
        if (cancelled) return;
        const onDay = items.filter((i) => localDayKey(new Date(itemAt(i))) === day);
        setSessions(groupSessions(onDay, breaks).reverse());
      },
      () => !cancelled && setSessions([]),
    );
    return () => {
      cancelled = true;
    };
  }, [db, day, version]);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="overline" color="text2" accessibilityRole="header" style={{ paddingHorizontal: spacing.xs }}>
        Daily habits
      </Text>
      {isToday ? <TodayReminder /> : null}
      {sessions.length ? (
        <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
          {sessions.map((s, i) => {
            const detail =
              s.kind === 'strength'
                ? `${s.exercises} exercise${s.exercises === 1 ? '' : 's'} · ${s.sets} set${s.sets === 1 ? '' : 's'}`
                : s.items[0].kind === 'class'
                  ? durationLabel(s.items[0].session.durationMin)
                  : '';
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`${localTimeLabel(s.start)} · ${s.name}, ${detail}${s.effort !== null ? `, effort ${s.effort}` : ''}`}
                onPress={() => router.push(s.kind === 'strength' ? `/session/${s.id}` : `/class/${s.id}`)}
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
                <WorkoutsIcon color={colors.accent} size={20} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.semibold }} numeric>{`${localTimeLabel(s.start)} · ${s.name}`}</Text>
                  <Text variant="caption" color="text2" numeric>
                    {detail}
                  </Text>
                </View>
                {s.effort !== null ? (
                  <Text variant="caption" color="text2" numeric>{`effort ${s.effort}`}</Text>
                ) : null}
                <Text color="text2">›</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {isToday ? (
        <TourTarget id="log-workout-pill">
          <Button
            variant="secondary"
            label="Log workout"
            onPress={() => router.push('/lift/new?from=today')}
            icon={<WorkoutsIcon color={colors.accent} size={20} />}
          />
        </TourTarget>
      ) : null}
    </View>
  );
}
