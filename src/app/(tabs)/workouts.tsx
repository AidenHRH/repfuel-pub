import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

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
import { trainingFeed } from '@/database/repositories/trainingRepository';
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
    trainingFeed(db, 60).then(
      (list) => !cancelled && setItems(list),
      () => !cancelled && setItems([]),
    );
    return () => {
      cancelled = true;
    };
  }, [db, version]);

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
            icon={<WorkoutsIcon color={colors.pro} />}
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
            <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
              {day.items.map((item, i) => (
                <FeedCard
                  key={item.kind === 'lift' ? item.lift.workoutId : item.session.id}
                  item={item}
                  day={day.label}
                  first={i === 0}
                  onPress={() => router.push(item.kind === 'lift' ? `/lift/${item.lift.workoutId}` : `/class/${item.session.id}`)}
                  onLongPress={() => confirmDelete(item)}
                />
              ))}
            </View>
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
