import type { Db } from './Db';
import { allMigrations, type Migration } from './migrations';

async function userVersion(db: Db): Promise<number> {
  const row = await db.getFirst<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies every migration newer than the database's `user_version`, each in its own
 * transaction, and returns the resulting version. Safe to call on every app start.
 */
export async function runMigrations(db: Db, migrations: Migration[] = allMigrations): Promise<number> {
  const pending = [...migrations].sort((a, b) => a.version - b.version);
  let current = await userVersion(db);

  for (const migration of pending) {
    if (migration.version <= current) continue;
    await db.transaction(async () => {
      await migration.up(db);
      // PRAGMA cannot take bound parameters; version is a trusted integer from code.
      await db.exec(`PRAGMA user_version = ${Math.trunc(migration.version)}`);
    });
    current = migration.version;
  }

  return current;
}
