import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { TrophyIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { allRecords } from '@/database/repositories/liftRepository';
import { MUSCLE_GROUP_LABELS, type Exercise } from '@/domain/exercises';
import { dayLabel, formatDuration, helpedLabel } from '@/domain/lifts';
import type { ExerciseRecords } from '@/domain/records';
import { workoutEvents } from '@/features/workouts/events';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Row = { exercise: Exercise; records: ExerciseRecords; lastAt: string };

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;

export default function ProgressScreen() {
  const db = useDb();
  const { colors } = useTheme();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => workoutEvents.subscribe((e) => e.type === 'changed' && setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    allRecords(db).then(
      (list) => !cancelled && setRows(list),
      () => !cancelled && setRows([]),
    );
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  return (
    <Screen title="Progress">
      {rows && rows.length === 0 ? (
        <EmptyState
          icon={<TrophyIcon color={colors.pro} />}
          title="No records yet"
          message="Log a workout and your best sets show up here, worked out from everything you log."
        />
      ) : null}
      {rows && rows.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="title" accessibilityRole="header">
            Records
          </Text>
          {rows.map((row) => (
            <RecordsCard key={row.exercise.id} {...row} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function RecordsCard({ exercise, records, lastAt }: Row) {
  const now = new Date();
  const tiles: { value: string; label: string; at: string }[] = [];
  if (records.heaviest) {
    tiles.push({
      value: `${kg(records.heaviest.weightKg!)} × ${records.heaviest.reps}`,
      label: 'Heaviest',
      at: records.heaviest.at,
    });
  }
  if (records.bestE1rm) {
    tiles.push({ value: `${Math.round(records.bestE1rm.value)} kg`, label: '1RM, estimate', at: records.bestE1rm.at });
  }
  if (records.mostReps) {
    tiles.push({ value: `${records.mostReps.reps} reps`, label: 'Most reps', at: records.mostReps.at });
  }
  if (records.bestSpotted) {
    const b = records.bestSpotted;
    tiles.push({
      value: `${kg(b.weightKg!)} × ${b.reps} ${helpedLabel(b.reps, b.assistedReps)}`,
      label: 'Spotted best',
      at: b.at,
    });
  }
  if (records.longestHold) {
    tiles.push({ value: formatDuration(records.longestHold.seconds), label: 'Longest hold', at: records.longestHold.at });
  }
  return (
    <Card accessibilityLabel={`Records for ${exercise.name}`} style={{ gap: spacing.lg }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Text variant="headline" style={{ flexShrink: 1 }}>
            {exercise.name}
          </Text>
          <Button
            variant="plain"
            label="How to"
            accessibilityLabel={`How to ${exercise.name}`}
            onPress={() => router.push(`/exercise/${exercise.id}`)}
          />
        </View>
        <Text variant="caption" color="text2">
          {`${MUSCLE_GROUP_LABELS[exercise.muscleGroup]} · last trained ${inSentence(dayLabel(lastAt, now))}`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {tiles.map((tile) => (
          <View key={tile.label} style={{ flex: 1, gap: 2 }}>
            <Text variant="title" numeric>
              {tile.value}
            </Text>
            <Text variant="caption" color="text2">
              {tile.label}
            </Text>
            <Text variant="caption" color="text2" numeric>
              {dayLabel(tile.at, now)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** "today" / "yesterday" read naturally mid-sentence; dates keep their capitals. */
function inSentence(label: string): string {
  return label === 'Today' || label === 'Yesterday' ? label.toLowerCase() : label;
}
