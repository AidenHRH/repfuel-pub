import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ModalScreen } from '@/components/ModalScreen';
import { PrBadge } from '@/components/PrBadge';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { sessionBreaks, trainingFeed } from '@/database/repositories/trainingRepository';
import { durationLabel, effortLabel } from '@/domain/classes';
import { localTimeLabel } from '@/domain/dates';
import { dayLabel, setsLabel } from '@/domain/lifts';
import { groupSessions, type Session } from '@/domain/sessions';
import { EffortChips, effortColor, StatTile } from '@/features/progress/parts';
import { workoutEvents } from '@/features/workouts/events';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

/** One training session: its exercises with every set, rep, weight and effort, and any PRs. */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const router = useRouter();
  const { colors, name: theme } = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => workoutEvents.subscribe((e) => e.type === 'changed' && setVersion((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([trainingFeed(db, 400), sessionBreaks(db)]).then(
      ([items, breaks]) => !cancelled && setSession(groupSessions(items, breaks).find((s) => s.id === id) ?? null),
      () => !cancelled && setSession(null),
    );
    return () => {
      cancelled = true;
    };
  }, [db, id, version]);

  if (session === undefined)
    return (
      <ModalScreen title="Session" onClose={() => router.back()}>
        {null}
      </ModalScreen>
    );
  if (session === null) {
    return (
      <ModalScreen title="Session" closeLabel="Done" onClose={() => router.back()}>
        <Text color="text2">This session isn’t there any more.</Text>
      </ModalScreen>
    );
  }

  return (
    <ModalScreen title={session.name} closeLabel="Done" onClose={() => router.back()}>
      <Text variant="callout" color="text2">{`${dayLabel(session.start)} · ${localTimeLabel(session.start)}`}</Text>
      {session.kind === 'strength' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <StatTile value={String(session.exercises)} label="Exercises" />
          <StatTile value={String(session.sets)} label="Sets" />
          <StatTile
            value={session.effort === null ? '—' : String(session.effort)}
            label="Average effort"
            color={session.effort === null ? undefined : effortColor(theme, session.effort)}
          />
          <StatTile value={String(session.prs)} label="PRs" color={colors.pr} />
        </View>
      ) : null}
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
        {session.items.map((item, i) =>
          item.kind === 'lift' ? (
            <Pressable
              key={item.lift.workoutId}
              accessibilityRole="button"
              accessibilityLabel={`${item.lift.exerciseName}: ${setsLabel(item.lift.sets)}${item.isPr ? ', a PR' : ''}`}
              accessibilityHint="Opens to edit"
              onPress={() => router.push(`/lift/${item.lift.workoutId}`)}
              style={({ pressed }) => ({
                padding: spacing.lg,
                gap: spacing.xs,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.sep,
                backgroundColor: pressed ? colors.well : 'transparent',
              })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="headline" style={{ flexShrink: 1 }}>
                  {item.lift.exerciseName}
                </Text>
                {item.isPr ? <PrBadge /> : null}
                <Text variant="caption" color="text2" numeric style={{ marginLeft: 'auto' }}>
                  {localTimeLabel(item.lift.at)}
                </Text>
              </View>
              <Text variant="callout" color="text2" numeric>
                {setsLabel(item.lift.sets)}
              </Text>
              <EffortChips efforts={item.lift.sets.map((s) => s.effort)} />
            </Pressable>
          ) : (
            <Pressable
              key={item.session.id}
              accessibilityRole="button"
              onPress={() => router.push(`/class/${item.session.id}`)}
              style={{ padding: spacing.lg, gap: spacing.xs }}>
              <Text variant="headline">{item.session.className}</Text>
              <Text variant="callout" color="text2">
                {`${durationLabel(item.session.durationMin)}${item.session.effort ? ` · ${item.session.effort}/10 · ${effortLabel(item.session.effort)}` : ''}`}
              </Text>
            </Pressable>
          ),
        )}
      </View>
      <Text variant="caption" color="text2" style={{ fontFamily: fonts.regular }}>
        Lifts within an hour of each other make one session. Hold a lift on Workouts to move it.
      </Text>
    </ModalScreen>
  );
}
