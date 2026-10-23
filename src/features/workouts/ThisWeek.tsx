import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FlameIcon, TrophyIcon, WorkoutsIcon } from '@/components/icons';
import { PrBadge } from '@/components/PrBadge';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useDb } from '@/database/DatabaseProvider';
import { trainingFeed } from '@/database/repositories/trainingRepository';
import { durationLabel, effortLabel } from '@/domain/classes';
import { dayLabel, setsLabel } from '@/domain/lifts';
import { itemAt, type FeedItem } from '@/domain/training';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { workoutEvents } from './events';

const SHOWN = 3;

/** Summary's "This week": the latest few sessions, each one line, with See all. */
export function ThisWeek() {
  const db = useDb();
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => workoutEvents.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    trainingFeed(db, SHOWN).then(
      (list) => !cancelled && setItems(list),
      () => !cancelled && setItems([]),
    );
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  if (!items || items.length === 0) return null;
  const now = new Date();

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader
        title="This week"
        action={{ label: 'See all', accessibilityLabel: 'See all training', onPress: () => router.navigate('/workouts') }}
      />
      <View style={{ backgroundColor: colors.card, borderRadius: radii.card, overflow: 'hidden' }}>
        {items.map((item, i) => {
          const isClass = item.kind === 'class';
          const pr = item.kind === 'lift' && item.isPr;
          const tint = pr ? colors.prBg : isClass ? colors.effortBg : colors.well;
          const iconColor = pr ? colors.pr : isClass ? colors.effort : colors.pro;
          const name = item.kind === 'lift' ? item.lift.exerciseName : item.session.className;
          const detail =
            item.kind === 'lift'
              ? `${setsLabel(item.lift.sets)} · ${dayLabel(item.lift.at, now)}`
              : `${durationLabel(item.session.durationMin)} · ${dayLabel(item.session.at, now)}`;
          return (
            <Pressable
              key={`${item.kind}:${itemAt(item)}`}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${detail}`}
              onPress={() => router.push(item.kind === 'lift' ? `/lift/${item.lift.workoutId}` : `/class/${item.session.id}`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.sep,
                backgroundColor: pressed ? colors.well : 'transparent',
              })}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: tint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {pr ? (
                  <TrophyIcon color={iconColor} size={20} />
                ) : isClass ? (
                  <FlameIcon color={iconColor} size={20} />
                ) : (
                  <WorkoutsIcon color={iconColor} size={20} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.medium, flexShrink: 1 }} numberOfLines={1}>
                    {name}
                  </Text>
                  {pr ? <PrBadge /> : null}
                </View>
                <Text variant="caption" color="text2" numeric numberOfLines={1}>
                  {detail}
                </Text>
              </View>
              {item.kind === 'class' && item.session.effort ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text numeric style={{ fontFamily: fonts.bold, color: colors.effort }}>
                    {`${item.session.effort}/10`}
                  </Text>
                  <Text variant="micro" color="text2">
                    {effortLabel(item.session.effort)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
