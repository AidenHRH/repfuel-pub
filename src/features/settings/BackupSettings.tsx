import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { ListGroup, ListRow } from '@/components/ListGroup';
import { BackupError, exportBackup, parseBackup, restoreBackup } from '@/database/backup';
import { useDb } from '@/database/DatabaseProvider';
import { localDayKey } from '@/domain/dates';
import { nutritionEvents } from '@/features/nutrition/events';
import { workoutEvents } from '@/features/workouts/events';
import { TourTarget } from '@/features/tour/TourTarget';
import { recordUse } from '@/database/repositories/tourRepository';

/** Your data: back it up to a file you can keep anywhere, or restore one (e.g. on a new phone). */
export function BackupSettings() {
  const db = useDb();

  const backUp = async () => {
    try {
      const file = new File(Paths.cache, `RepFuel-backup-${localDayKey(new Date())}.json`);
      file.create({ overwrite: true });
      await file.write(JSON.stringify(await exportBackup(db)));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your RepFuel backup' });
      await recordUse(db, 'backup').catch(() => undefined);
    } catch {
      Alert.alert('Couldn’t back up', 'Please try again. Your data on this phone is unchanged.');
    }
  };

  const restore = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
      if (picked.canceled || !picked.result) return;
      const backup = parseBackup(await picked.result.text());
      Alert.alert(
        'Replace everything on this phone?',
        `Your food, training, meals and settings are replaced by the backup from ${new Date(backup.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreBackup(db, backup);
                nutritionEvents.emit({ type: 'changed' });
                workoutEvents.emit({ type: 'changed' });
                Alert.alert('Restored', 'Your backup is back on this phone.');
              } catch (e) {
                Alert.alert('Couldn’t restore', e instanceof BackupError ? e.message : 'Nothing was changed. Please try again.');
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Couldn’t restore', e instanceof BackupError ? e.message : 'That file couldn’t be read. Nothing was changed.');
    }
  };

  return (
    <TourTarget id="settings-backup">
      <ListGroup
        title="Your data"
        footer="Updates keep your data: install new versions over the top (Update, not uninstall). A backup is for a new phone, or just in case.">
        <ListRow label="Back up to a file" onPress={() => void backUp()} />
        <ListRow label="Restore from a file" onPress={() => void restore()} />
      </ListGroup>
    </TourTarget>
  );
}
