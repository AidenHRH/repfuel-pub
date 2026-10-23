import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { useDb } from '@/database/DatabaseProvider';
import { setSetting } from '@/database/repositories/settingsRepository';
import { getCurrentTargets, setTargets as saveTargets } from '@/database/repositories/targetsRepository';
import { roundForDisplay } from '@/domain/nutrition';
import { validateTargets } from '@/domain/targets';
import type { NutritionTargets } from '@/domain/types';
import { nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';
import { ReminderSettings } from '@/features/reminders/ReminderSettings';
import { BackupSettings } from '@/features/settings/BackupSettings';
import { useSetting } from '@/features/useSetting';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, type ThemeName } from '@/theme/tokens';
import { HelpSettings } from '@/features/settings/HelpSettings';

export default function SettingsScreen() {
  const db = useDb();
  const { name, setTheme, colors } = useTheme();
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [editing, setEditing] = useState(false);
  const [kcalText, setKcalText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [showMotivation, setShowMotivation] = useSetting('showMotivation', true);

  const load = useCallback(() => getCurrentTargets(db).then(setTargets, () => setTargets(null)), [db]);
  useEffect(() => {
    void load();
  }, [load]);

  const openTargets = () => {
    if (!targets) return;
    setKcalText(String(targets.caloriesKcal));
    setProteinText(String(targets.proteinGrams));
    setEditing(true);
  };
  const parsedTargets = validateTargets(kcalText, proteinText);
  const targetsValid = parsedTargets.ok;

  const saveNewTargets = async () => {
    if (!targets || !parsedTargets.ok) return;
    // A new row from now on: past days keep being judged against the targets of the time.
    const saved = await safely('save your targets', () =>
      saveTargets(db, {
        caloriesKcal: parsedTargets.caloriesKcal,
        proteinGrams: parsedTargets.proteinGrams,
        carbohydratesGrams: targets.carbohydratesGrams,
        fatGrams: targets.fatGrams,
        effectiveFrom: new Date().toISOString(),
      }),
    );
    if (!saved) return;
    setEditing(false);
    await load();
    nutritionEvents.emit({ type: 'changed' });
  };

  const chooseAppearance = (next: ThemeName) => {
    setTheme(next);
    void safely('save your theme', () => setSetting(db, 'appearance', next));
  };

  return (
    <Screen title="Settings">
      <ListGroup
        title="Daily targets"
        footer="The calorie target is a starting point, not a measured maintenance level. RepFuel never changes your targets on its own.">
        <ListRow
          label="Calories"
          value={targets ? `${roundForDisplay(targets.caloriesKcal, 'kcal')} kcal` : '—'}
          onPress={openTargets}
        />
        <ListRow
          label="Protein"
          value={targets ? `${roundForDisplay(targets.proteinGrams, 'g')} g` : '—'}
          onPress={openTargets}
        />
      </ListGroup>

      <ListGroup title="Appearance">
        <View style={{ padding: spacing.md }}>
          <Segmented
            accessibilityLabel="Theme"
            value={name}
            onChange={chooseAppearance}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
        </View>
      </ListGroup>

      <ListGroup title="Today" footer="A short line on Today to keep you going. A new one each day.">
        <ListRow label="Daily motivation">
          <Switch
            accessibilityLabel="Daily motivation"
            value={showMotivation ?? true}
            onValueChange={setShowMotivation}
            trackColor={{ true: colors.pro, false: colors.well }}
            thumbColor="#FFFFFF"
          />
        </ListRow>
      </ListGroup>

      <ReminderSettings />

      <BackupSettings />

      <HelpSettings />

      <ListGroup
        title="About"
        footer="Barcode product data comes from Open Food Facts (openfoodfacts.org), available under the Open Database Licence. Your own data stays on this phone.">
        <ListRow label="Version" value={Constants.expoConfig?.version ?? '—'} />
        <ListRow label="Food database" value="Open Food Facts" />
      </ListGroup>

      <Sheet visible={editing} title="Daily targets" onClose={() => setEditing(false)}>
        <View style={{ backgroundColor: colors.well, borderRadius: 18 }}>
          <TextField
            label="Calories"
            accessibilityLabel="Calorie target"
            value={kcalText}
            onChangeText={setKcalText}
            keyboardType="decimal-pad"
            suffix="kcal"
          />
          <View style={{ height: 1, backgroundColor: colors.sep, marginLeft: spacing.lg }} />
          <TextField
            label="Protein"
            accessibilityLabel="Protein target"
            value={proteinText}
            onChangeText={setProteinText}
            keyboardType="decimal-pad"
            suffix="g"
          />
        </View>
        <Button label="Save targets" onPress={saveNewTargets} disabled={!targetsValid} />
      </Sheet>
    </Screen>
  );
}
