import type { Db } from '../Db';

/** Reads a JSON setting, or `fallback` when it is missing or unreadable. */
export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.getFirst<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
    key,
    JSON.stringify(value),
  ]);
}
