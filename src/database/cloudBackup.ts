import { Directory, File, Paths } from 'expo-file-system';

import { localDayKey } from '@/domain/dates';
import { CloudError, type Cloud, type CloudFailure } from '@/services/cloud/types';

import { exportBackup, parseBackup, restoreBackup, type BackupFile } from './backup';
import type { Db } from './Db';
import { getSetting, setSetting } from './repositories/settingsRepository';

/** How many days of backups the server keeps, so a bad day can be undone. */
export const KEEP_DAYS = 14;

const STATUS_KEY = 'cloud';

export type CloudStatus = {
  lastBackupAt: string | null;
  lastAttemptAt: string | null;
  lastError: CloudFailure | null;
  /** A fingerprint of the data last uploaded, to skip uploads when nothing changed. */
  lastHash: string | null;
};

const EMPTY: CloudStatus = { lastBackupAt: null, lastAttemptAt: null, lastError: null, lastHash: null };

export async function getCloudStatus(db: Db): Promise<CloudStatus> {
  return { ...EMPTY, ...(await getSetting<Partial<CloudStatus>>(db, STATUS_KEY, {})) };
}

async function saveCloudStatus(db: Db, patch: Partial<CloudStatus>) {
  await setSetting(db, STATUS_KEY, { ...(await getCloudStatus(db)), ...patch });
}

/** FNV-1a over the text: enough to tell "same data" from "changed". */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const backupName = (day: string) => `backup-${day}.json`;
const BACKUP_NAME = /^backup-(\d{4}-\d{2}-\d{2})\.json$/;
const fileName = (uri: string) => uri.split('/').pop() ?? uri;

/** The phone's data for the server: everything except this phone's own sync status. */
async function cloudCopy(db: Db, now: Date): Promise<BackupFile> {
  const file = await exportBackup(db, now);
  const settings = file.tables.app_settings;
  if (settings) file.tables.app_settings = settings.filter((row) => row.key !== STATUS_KEY);
  return file;
}

/**
 * Uploads today's backup (replacing an earlier one from today) and any recipe photos the server doesn't have yet,
 * then deletes backups older than KEEP_DAYS. Skips the upload when nothing changed since the last one.
 * Throws CloudError; the failure is recorded in the status.
 */
export async function backupNow(db: Db, cloud: Cloud, userId: string, now: Date = new Date()): Promise<'uploaded' | 'unchanged'> {
  await saveCloudStatus(db, { lastAttemptAt: now.toISOString() });
  try {
    const file = await cloudCopy(db, now);
    const hash = fingerprint(JSON.stringify(file.tables));
    const status = await getCloudStatus(db);
    if (status.lastHash === hash && status.lastBackupAt) {
      await saveCloudStatus(db, { lastError: null });
      return 'unchanged';
    }

    const have = new Set(await cloud.store.list(`${userId}/photos`));
    for (const row of file.tables.recipe_photo ?? []) {
      const uri = String(row.file_uri);
      const name = fileName(uri);
      if (have.has(name)) continue;
      const local = new File(uri);
      if (!local.exists) continue;
      await cloud.store.uploadBytes(`${userId}/photos/${name}`, await local.bytes(), 'image/jpeg');
    }

    await cloud.store.uploadText(`${userId}/${backupName(localDayKey(now))}`, JSON.stringify(file));

    const oldest = localDayKey(new Date(now.getTime() - KEEP_DAYS * 86_400_000));
    const expired = (await cloud.store.list(userId)).filter((n) => {
      const m = BACKUP_NAME.exec(n);
      return m !== null && m[1] < oldest;
    });
    if (expired.length) await cloud.store.remove(expired.map((n) => `${userId}/${n}`));

    await saveCloudStatus(db, { lastBackupAt: now.toISOString(), lastHash: hash, lastError: null });
    return 'uploaded';
  } catch (error) {
    const kind = error instanceof CloudError ? error.kind : 'other';
    await saveCloudStatus(db, { lastError: kind });
    throw error instanceof CloudError ? error : new CloudError('other', String(error));
  }
}

/** The newest backup on the server, or null when there isn't one. */
export async function latestCloudBackup(cloud: Cloud, userId: string): Promise<{ path: string; day: string } | null> {
  const days = (await cloud.store.list(userId)).flatMap((n) => BACKUP_NAME.exec(n)?.[1] ?? []).sort();
  const day = days.at(-1);
  return day ? { path: `${userId}/${backupName(day)}`, day } : null;
}

/** True once anything has been logged or saved on this phone (the same test the welcome setup uses). */
export async function phoneHasData(db: Db): Promise<boolean> {
  const row = await db.getFirst<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM food_log_entry) + (SELECT COUNT(*) FROM workout) + (SELECT COUNT(*) FROM recipe) AS n',
  );
  return (row?.n ?? 0) > 0;
}

/**
 * Replaces the phone's data with the newest backup on the server and brings its photos back. A photo that can't
 * be downloaded is left off rather than stopping the restore. Throws CloudError, or BackupError for a bad file.
 */
export async function restoreFromCloud(db: Db, cloud: Cloud, userId: string): Promise<{ day: string }> {
  const latest = await latestCloudBackup(cloud, userId);
  if (!latest) throw new CloudError('other', 'There’s no backup to restore yet.');
  const file = parseBackup(await cloud.store.downloadText(latest.path));

  const folder = new Directory(Paths.document, 'recipe-photos');
  if (!folder.exists) folder.create();
  const photos: Record<string, unknown>[] = [];
  for (const row of file.tables.recipe_photo ?? []) {
    const name = fileName(String(row.file_uri));
    const target = new File(folder, name);
    try {
      await cloud.store.downloadToFile(`${userId}/photos/${name}`, target);
      photos.push({ ...row, file_uri: target.uri });
    } catch {
      // Without its photo the recipe still restores.
    }
  }
  if (file.tables.recipe_photo) file.tables.recipe_photo = photos;

  await restoreBackup(db, file);
  await saveCloudStatus(db, { lastBackupAt: null, lastHash: null, lastError: null });
  return { day: latest.day };
}
