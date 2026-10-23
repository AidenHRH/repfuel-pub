import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { CREATINE_DOSES, creatineCaption, scoopsLabel } from '@/domain/creatine';
import { friendlyNumber } from '@/domain/format';
import { timeLabel } from '@/domain/reminders';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radii, spacing } from '@/theme/tokens';

import { useReminder } from './useReminder';

/**
 * Today's creatine: Taken tops today up to the daily amount (which skips today's notification); tap the name for
 * another amount (2.5, 5, 10 g), which adds to today; Taken ✓ clears a mistake. Hidden when the reminder is off.
 */
export function TodayReminder() {
  const { colors } = useTheme();
  const { reminder, setDoneToday, takeDose } = useReminder('creatine');
  const [choosing, setChoosing] = useState(false);
  if (!reminder?.enabled) return null;

  const name = reminder.name.toLowerCase();
  const { dailyG, scoopG } = reminder.creatine;
  const complete = reminder.doneToday && (reminder.takenG === null || reminder.takenG >= dailyG);
  const streak = reminder.streak > 1 ? ` · ${reminder.streak}-day streak` : '';
  const caption =
    creatineCaption({ done: reminder.doneToday, takenG: reminder.takenG, dailyG }) ??
    `Due ${timeLabel(reminder.hour, reminder.minute)}`;

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose how much ${name}`}
        accessibilityHint={`${caption}${streak}`}
        onPress={() => setChoosing(true)}
        style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontFamily: fonts.semibold }}>{reminder.name}</Text>
        <Text variant="caption" color="text2" numeric>
          {`${caption}${streak}`}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={complete ? `Undo ${name} taken` : `Mark ${name} taken`}
        onPress={() => void setDoneToday(!complete)}
        style={({ pressed }) => ({
          minHeight: 40,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.pill,
          justifyContent: 'center',
          backgroundColor: complete ? colors.well : colors.pro,
          opacity: pressed ? 0.8 : 1,
        })}>
        <Text variant="callout" style={{ fontFamily: fonts.semibold, color: complete ? colors.pro : colors.onAccent }}>
          {complete ? 'Taken ✓' : 'Taken'}
        </Text>
      </Pressable>

      <Sheet visible={choosing} title={`How much ${name}?`} onClose={() => setChoosing(false)}>
        <View style={{ gap: spacing.sm }}>
          {CREATINE_DOSES.map((g) => (
            <Button
              key={g}
              variant={g === dailyG ? 'primary' : 'secondary'}
              label={`${friendlyNumber(g)} g · ${scoopsLabel(g, scoopG)}`}
              onPress={() => {
                setChoosing(false);
                void takeDose(g);
              }}
            />
          ))}
        </View>
        <Text variant="caption" color="text2">
          Adds to today. Your usual amount is {friendlyNumber(dailyG)} g; change it in Settings › Reminders.
        </Text>
        {reminder.doneToday ? (
          <Button
            variant="plain"
            label="Clear today"
            onPress={() => {
              setChoosing(false);
              void setDoneToday(false);
            }}
          />
        ) : null}
      </Sheet>
    </Card>
  );
}
