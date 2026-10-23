import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { MUSCLE_GROUP_LABELS, type Exercise } from '@/domain/exercises';
import { dayLabel, formatDuration, helpedLabel } from '@/domain/lifts';
import type { ExerciseRecords } from '@/domain/records';
import { spacing } from '@/theme/tokens';

export type RecordsRow = { exercise: Exercise; records: ExerciseRecords; lastAt: string };

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;

export function RecordsCard({ exercise, records, lastAt }: RecordsRow) {
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
