import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { TrophyIcon, WorkoutsIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Snackbar } from '@/components/Snackbar';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { deleteClass } from '@/database/repositories/classRepository';
import { deleteLift } from '@/database/repositories/liftRepository';
import { sessionBreaks, setSessionBreak, trainingFeed } from '@/database/repositories/trainingRepository';
import { localTimeLabel } from '@/domain/dates';
import { groupSessions, type Session, type SessionBreaks } from '@/domain/sessions';
import type { RecordEvent } from '@/domain/records';
import { dayEffort, groupFeedByDay, weekSummary, type FeedItem } from '@/domain/training';
import { effortColor } from '@/features/progress/parts';
import { safely } from '@/features/safely';
import { workoutEvents } from '@/features/workouts/events';
import { FeedCard } from '@/features/workouts/FeedCard';
import { WeekCard } from '@/features/workouts/WeekCard';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

type Celebration = { key: number; name: string; records: RecordEvent[] };

export default function WorkoutsScreen() {
  const db = useDb();
  const router = useRouter();
  const { colors, name: theme } = useTheme();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [breaks, setBreaks] = useState<SessionBreaks>({});
  const [version, setVersion] = useState(0);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [saved, setSaved] = useState<{ key: number; name: string } | null>(null);

  useEffect(
    () =>
      workoutEvents.subscribe((event) => {
        if (event.type === 'changed') setVersion((v) => v + 1);
        if (event.type === 'logged') {
          if (event.records.length) setCelebration({ key: Date.now(), name: event.name, records: event.records });
          else setSaved({ key: Date.now(), name: event.name });
        }
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([trainingFeed(db, 60), sessionBreaks(db)]).then(
      ([list, b]) => {
        if (cancelled) return;
        setItems(list);
        setBreaks(b);
      },
      () => !cancelled && setItems([]),
    );
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  const moveLift = async (workoutId: string, value: 'split' | 'join') => {
    await safely('move that lift', () => setSessionBreak(db, workoutId, value));
    workoutEvents.emit({ type: 'changed' });
  };

  /** Hold: move a lift between sessions, or delete it. */
  const holdOptions = (item: FeedItem, session: Session, earlierSameDay: boolean) => {
    if (item.kind !== 'lift') return confirmDelete(item);
    const first = session.items[0] === item;
    const name = item.lift.exerciseName;
    Alert.alert(name, undefined, [
      ...(first && earlierSameDay
        ? [{ text: 'Move to previous session', onPress: () => void moveLift(item.lift.workoutId, 'join') }]
        : []),
      ...(!first ? [{ text: 'Start new session', onPress: () => void moveLift(item.lift.workoutId, 'split') }] : []),
      { text: 'Delete', style: 'destructive' as const, onPress: () => confirmDelete(item) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const confirmDelete = (item: FeedItem) =>
    Alert.alert(
      `Delete ${item.kind === 'lift' ? item.lift.exerciseName : item.session.className}?`,
      item.kind === 'lift' ? 'Your records will be worked out again without it.' : 'It leaves your training history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await safely(item.kind === 'lift' ? 'delete that lift' : 'delete that class', () =>
              item.kind === 'lift' ? deleteLift(db, item.lift.workoutId) : deleteClass(db, item.session.id),
            );
            workoutEvents.emit({ type: 'changed' });
          },
        },
      ],
    );

  const now = new Date();
  const days = groupFeedByDay(items ?? [], now);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen title="Workouts" bottomInset={72}>
        {celebration ? (
          <Card hero accessibilityRole="alert" style={{ gap: spacing.md, backgroundColor: colors.prBg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.well,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <TrophyIcon color={colors.pr} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="overline" color="pr">
                  New PR
                </Text>
                <Text variant="headline">{celebration.name}</Text>
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              {celebration.records.map((r) => (
                <Text key={r.type} numeric>
                  {r.label}
                </Text>
              ))}
            </View>
            <Button
              variant="plain"
              label="Nice"
              accessibilityLabel="Dismiss"
              onPress={() => setCelebration(null)}
              style={{ alignSelf: 'flex-start' }}
            />
          </Card>
        ) : null}

        {items && items.length > 0 ? <WeekCard week={weekSummary(items, now)} /> : null}

        {items && items.length === 0 ? (
          <EmptyState
            icon={<WorkoutsIcon color={colors.accent} />}
            title="No training yet"
            message="Log a set or three as you train, or a class like Hyrox. RepFuel remembers last time and spots your PRs."
          />
        ) : null}

        {days.map((day) => (
          <View key={day.day} style={{ gap: spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingHorizontal: spacing.xs,
              }}>
              <Text variant="overline" color="text2" accessibilityRole="header">
                {day.label}
              </Text>
              {dayEffort(day.items) !== null ? (
                <Text
                  variant="caption"
                  numeric
                  accessibilityLabel={`Average effort ${dayEffort(day.items)} out of 10`}
                  style={{ color: effortColor(theme, dayEffort(day.items)!), fontFamily: fonts.semibold }}>
                  {`effort ${dayEffort(day.items)}`}
                </Text>
              ) : null}
            </View>
            {groupSessions(day.items, breaks).map((session, si, all) => (
              <View key={session.id} style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
                {session.kind === 'strength' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${localTimeLabel(session.start)} session: ${session.name}, ${session.exercises} exercise${session.exercises === 1 ? '' : 's'}, ${session.sets} sets`}
                    accessibilityHint="Shows every set"
                    onPress={() => router.push(`/session/${session.id}`)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.lg,
                      paddingTop: spacing.md,
                      paddingBottom: spacing.xs,
                      opacity: pressed ? 0.6 : 1,
                    })}>
                    <Text variant="callout" style={{ fontFamily: fonts.semibold, flex: 1 }} numeric>
                      {`${localTimeLabel(session.start)} · ${session.name}`}
                    </Text>
                    <Text variant="caption" color="accent">
                      Sets ›
                    </Text>
                  </Pressable>
                ) : null}
                {session.items.map((item, i) => (
                  <FeedCard
                    key={item.kind === 'lift' ? item.lift.workoutId : item.session.id}
                    item={item}
                    day={day.label}
                    first={i === 0}
                    onPress={() =>
                      router.push(item.kind === 'lift' ? `/lift/${item.lift.workoutId}` : `/class/${item.session.id}`)
                    }
                    onLongPress={() =>
                      holdOptions(
                        item,
                        session,
                        all.slice(si + 1).some((o) => o.kind === 'strength'),
                      )
                    }
                  />
                ))}
              </View>
            ))}
          </View>
        ))}
      </Screen>

      {saved ? (
        <Snackbar
          key={saved.key}
          message={`Saved ${saved.name}`}
          onTimeout={() => setSaved((current) => (current?.key === saved.key ? null : current))}
          actions={[]}
        />
      ) : (
        <Button
          label="Log workout"
          onPress={() => {
            setCelebration(null);
            router.push('/lift/new');
          }}
          style={{
            position: 'absolute',
            alignSelf: 'center',
            bottom: spacing.lg,
            height: 52,
            paddingHorizontal: spacing.xxl,
            boxShadow: '0px 10px 28px rgba(0,0,0,0.28)',
          }}
          icon={<WorkoutsIcon color={colors.onAccent} size={20} />}
        />
      )}
    </View>
  );
}
