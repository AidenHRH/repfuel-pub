import { useState } from 'react';
import { Linking, Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Text } from '@/components/Text';
import { stepDaily } from '@/domain/creatine';
import { friendlyNumber } from '@/domain/format';
import { shiftTime, timeLabel } from '@/domain/reminders';
import { allowNotifications } from '@/services/reminderNotifications';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { TourTarget } from '@/features/tour/TourTarget';

import { useReminder } from './useReminder';

/** Settings → Reminders: the creatine reminder's switch and time, the usual daily amount and the scoop size. */
export function ReminderSettings() {
  const { colors } = useTheme();
  const { reminder, change, setCreatine } = useReminder('creatine');
  const [blocked, setBlocked] = useState(false);

  const toggle = async (on: boolean) => {
    if (on && !(await allowNotifications().catch(() => false))) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    await change({ enabled: on });
  };

  return (
    <TourTarget id="settings-reminders">
      <ListGroup
        title="Reminders"
        footer="A daily nudge with a Taken button that logs your daily amount. Once you’ve ticked it off, that day’s reminder is skipped.">
        <ListRow label="Creatine reminder">
          <Switch
            accessibilityLabel="Creatine reminder"
            value={reminder?.enabled ?? false}
            onValueChange={(on) => void toggle(on)}
            trackColor={{ true: colors.accent, false: colors.well }}
            thumbColor="#FFFFFF"
          />
        </ListRow>
        {reminder?.enabled ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, minHeight: 52, gap: spacing.sm }}>
            <Text style={{ flex: 1 }}>Time</Text>
            <Button
              variant="plain"
              label="−"
              accessibilityLabel="Remind 15 minutes earlier"
              onPress={() => void change(shiftTime(reminder, -15))}
            />
            <Text numeric style={{ minWidth: 56, textAlign: 'center' }}>
              {timeLabel(reminder.hour, reminder.minute)}
            </Text>
            <Button
              variant="plain"
              label="+"
              accessibilityLabel="Remind 15 minutes later"
              onPress={() => void change(shiftTime(reminder, 15))}
            />
          </View>
        ) : null}
        {reminder?.enabled ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, minHeight: 52, gap: spacing.sm }}>
            <Text style={{ flex: 1 }}>Daily amount</Text>
            <Button
              variant="plain"
              label="−"
              accessibilityLabel="Less creatine a day"
              onPress={() => void setCreatine({ ...reminder.creatine, dailyG: stepDaily(reminder.creatine.dailyG, -1) })}
            />
            <Text numeric style={{ minWidth: 56, textAlign: 'center' }}>
              {`${friendlyNumber(reminder.creatine.dailyG)} g`}
            </Text>
            <Button
              variant="plain"
              label="+"
              accessibilityLabel="More creatine a day"
              onPress={() => void setCreatine({ ...reminder.creatine, dailyG: stepDaily(reminder.creatine.dailyG, 1) })}
            />
          </View>
        ) : null}
        {reminder?.enabled ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}>
            <Text>One scoop</Text>
            <Segmented
              accessibilityLabel="One scoop"
              value={String(reminder.creatine.scoopG)}
              onChange={(g) => void setCreatine({ ...reminder.creatine, scoopG: g === '2.5' ? 2.5 : 5 })}
              options={[
                { value: '2.5', label: '2.5 g' },
                { value: '5', label: '5 g' },
              ]}
            />
          </View>
        ) : null}
        {blocked ? (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            <Text variant="callout" color="text2">
              Notifications are turned off for RepFuel. Turn them on in Android settings to get reminders.
            </Text>
            <Button variant="secondary" label="Open settings" onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
      </ListGroup>
    </TourTarget>
  );
}
