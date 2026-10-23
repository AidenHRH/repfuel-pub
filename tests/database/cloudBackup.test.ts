import { File } from 'expo-file-system';

import { backupNow, getCloudStatus, latestCloudBackup, phoneHasData, restoreFromCloud } from '@/database/cloudBackup';
import { createRecipe, listRecipes } from '@/database/repositories/recipeRepository';
import { getRecipePhoto, setRecipePhoto } from '@/database/repositories/recipePhotoRepository';

import { fakeCloud } from '../helpers/fakeCloud';
import { migratedDb } from '../helpers/seed';

const files = (File as unknown as { store: Map<string, string> }).store;
const day = (iso: string) => new Date(iso);

test('backs up the data as one file a day in your own folder, and skips when nothing changed', async () => {
  const db = await migratedDb();
  const { cloud, files: server } = fakeCloud();
  await createRecipe(db, { name: 'Overnight oats', portionsMade: 1, ingredients: [] });

  expect(await backupNow(db, cloud, 'user-1', day('2026-10-23T09:00:00Z'))).toBe('uploaded');
  expect([...server.keys()]).toEqual(['user-1/backup-2026-10-23.json']);
  expect(JSON.parse(server.get('user-1/backup-2026-10-23.json')!).tables.recipe).toHaveLength(1);
  expect((await getCloudStatus(db)).lastBackupAt).toBe('2026-10-23T09:00:00.000Z');

  expect(await backupNow(db, cloud, 'user-1', day('2026-10-23T12:00:00Z'))).toBe('unchanged');
  await createRecipe(db, { name: 'Chilli', portionsMade: 4, ingredients: [] });
  expect(await backupNow(db, cloud, 'user-1', day('2026-10-23T13:00:00Z'))).toBe('uploaded');
  expect(server.size).toBe(1);
});

test('keeps 14 days of backups', async () => {
  const db = await migratedDb();
  const { cloud, files: server } = fakeCloud();
  server.set('user-1/backup-2026-10-01.json', '{}');
  server.set('user-1/backup-2026-10-10.json', '{}');
  await createRecipe(db, { name: 'Oats', portionsMade: 1, ingredients: [] });
  await backupNow(db, cloud, 'user-1', day('2026-10-23T09:00:00Z'));
  expect([...server.keys()].sort()).toEqual(['user-1/backup-2026-10-10.json', 'user-1/backup-2026-10-23.json']);
});

test('uploads each recipe photo once', async () => {
  const db = await migratedDb();
  const { cloud, files: server } = fakeCloud();
  files.set('file:///picked/1.jpg', 'jpeg-bytes');
  const uri = await setRecipePhoto(db, 'template:turkey-chilli', 'file:///picked/1.jpg');
  const name = uri.split('/').pop()!;
  await backupNow(db, cloud, 'user-1', day('2026-10-23T09:00:00Z'));
  expect(server.get(`user-1/photos/${name}`)).toBe('jpeg-bytes');
});

test('restores the latest backup and its photos onto a new phone', async () => {
  const old = await migratedDb();
  const { cloud } = fakeCloud();
  files.set('file:///picked/2.jpg', 'chilli-photo');
  await createRecipe(old, { name: 'Overnight oats', portionsMade: 1, ingredients: [] });
  const uri = await setRecipePhoto(old, 'template:turkey-chilli', 'file:///picked/2.jpg');
  await backupNow(old, cloud, 'user-1', day('2026-10-22T09:00:00Z'));
  files.delete(uri);

  const fresh = await migratedDb();
  expect(await phoneHasData(fresh)).toBe(false);
  expect(await latestCloudBackup(cloud, 'user-1')).toEqual({ path: 'user-1/backup-2026-10-22.json', day: '2026-10-22' });
  await restoreFromCloud(fresh, cloud, 'user-1');
  expect((await listRecipes(fresh, {})).map((r) => r.name)).toEqual(['Overnight oats']);
  const restored = (await getRecipePhoto(fresh, 'template:turkey-chilli'))!;
  expect(restored).toMatch(/^file:\/\/\/docs\/recipe-photos\//);
  expect(files.get(restored)).toBe('chilli-photo');
  expect(await phoneHasData(fresh)).toBe(true);
});

test('a failure is recorded, and the data on the phone is untouched', async () => {
  const db = await migratedDb();
  const { cloud, state } = fakeCloud();
  await createRecipe(db, { name: 'Oats', portionsMade: 1, ingredients: [] });
  state.failWith = 'offline';
  await expect(backupNow(db, cloud, 'user-1', day('2026-10-23T09:00:00Z'))).rejects.toMatchObject({ kind: 'offline' });
  expect(await getCloudStatus(db)).toMatchObject({ lastBackupAt: null, lastError: 'offline' });
  expect(await listRecipes(db, {})).toHaveLength(1);
});

test('no backup yet', async () => {
  const { cloud } = fakeCloud();
  expect(await latestCloudBackup(cloud, 'user-1')).toBeNull();
});
