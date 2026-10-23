import { runMigrations } from '@/database/migrate';
import { getSetting, setSetting } from '@/database/repositories/settingsRepository';

import { createTestDb } from '../helpers/testDb';

async function migrated() {
  const db = createTestDb();
  await runMigrations(db);
  return db;
}

test('returns the fallback when a setting was never saved', async () => {
  const db = await migrated();
  expect(await getSetting(db, 'appearance', 'dark')).toBe('dark');
});

test('saves and overwrites a setting', async () => {
  const db = await migrated();
  await setSetting(db, 'appearance', 'light');
  expect(await getSetting(db, 'appearance', 'dark')).toBe('light');
  await setSetting(db, 'appearance', 'dark');
  expect(await getSetting(db, 'appearance', 'light')).toBe('dark');
});

test('round-trips structured values', async () => {
  const db = await migrated();
  await setSetting(db, 'reminders', { enabled: true, start: '09:00' });
  expect(await getSetting(db, 'reminders', null)).toEqual({ enabled: true, start: '09:00' });
});

test('falls back when a stored value is corrupt', async () => {
  const db = await migrated();
  await db.run(`INSERT INTO app_settings (key, value) VALUES ('appearance', '{not json')`);
  expect(await getSetting(db, 'appearance', 'dark')).toBe('dark');
});
