import { useEffect, useState } from 'react';
import { Switch } from 'react-native';

import { ListGroup, ListRow } from '@/components/ListGroup';
import { useDb } from '@/database/DatabaseProvider';
import { getTourState } from '@/database/repositories/tourRepository';
import { useTour } from '@/features/tour/TourProvider';
import { safely } from '@/features/safely';
import { useTheme } from '@/theme/ThemeProvider';

/** Help: the tour again, and the occasional tips about things not used lately. */
export function HelpSettings() {
  const db = useDb();
  const { colors } = useTheme();
  const { start, setTipsOn } = useTour();
  const [tipsOn, setShownOn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTourState(db).then(
      (state) => !cancelled && setShownOn(state.tipsOn),
      () => !cancelled && setShownOn(true),
    );
    return () => {
      cancelled = true;
    };
  }, [db]);

  const toggle = async (on: boolean) => {
    setShownOn(on);
    await safely('change Helpful tips', () => setTipsOn(on));
  };

  return (
    <ListGroup title="Help" footer="Tips point out things you haven’t used lately, at most one every few days.">
      <ListRow label="Show the tour again" onPress={start} />
      <ListRow label="Helpful tips">
        <Switch
          accessibilityLabel="Helpful tips"
          value={tipsOn ?? true}
          onValueChange={(on) => void toggle(on)}
          trackColor={{ true: colors.accent, false: colors.well }}
          thumbColor="#FFFFFF"
        />
      </ListRow>
    </ListGroup>
  );
}
