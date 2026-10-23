import type { Db } from './Db';

/** Everything on the phone, as one JSON file: every table's rows, and the schema version they came from. */
export type BackupFile = {
  app: 'RepFuel';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export class BackupError extends Error {
  constructor(readonly reason: 'not_repfuel' | 'newer') {
    super(
      reason === 'newer' ? 'This backup is from a newer RepFuel. Update RepFuel first.' : 'That file isn’t a RepFuel backup.',
    );
    this.name = 'BackupError';
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

async function schemaVersion(db: Db): Promise<number> {
  return (await db.getFirst<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}

async function tableNames(db: Db): Promise<string[]> {
  const rows = await db.getAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

// Table and column names come from sqlite_master and PRAGMA table_info, never from the file.
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function exportBackup(db: Db, now: Date = new Date()): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const name of await tableNames(db))
    tables[name] = await db.getAll<Record<string, unknown>>(`SELECT * FROM ${quote(name)}`);
  return { app: 'RepFuel', schemaVersion: await schemaVersion(db), exportedAt: now.toISOString(), tables };
}

export function parseBackup(text: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('not_repfuel');
  }
  if (!isObject(json) || json.app !== 'RepFuel' || typeof json.schemaVersion !== 'number' || !isObject(json.tables)) {
    throw new BackupError('not_repfuel');
  }
  for (const rows of Object.values(json.tables)) {
    if (!Array.isArray(rows) || !rows.every(isObject)) throw new BackupError('not_repfuel');
  }
  return json as BackupFile;
}

/**
 * Replaces the phone's data with the backup's, all or nothing. A backup from an older RepFuel still restores:
 * columns it doesn't have keep their current values, and tables it doesn't have are left alone.
 */
export async function restoreBackup(db: Db, file: BackupFile): Promise<void> {
  if (file.schemaVersion > (await schemaVersion(db))) throw new BackupError('newer');
  const existing = new Set(await tableNames(db));
  await db.transaction(async () => {
    // Rows go back in any order; references are checked when the whole restore commits.
    await db.exec('PRAGMA defer_foreign_keys = ON');
    for (const [table, rows] of Object.entries(file.tables)) {
      if (!existing.has(table)) continue;
      const info = await db.getAll<{ name: string; pk: number }>(`PRAGMA table_info(${quote(table)})`);
      const columns = new Set(info.map((c) => c.name));
      const keys = info
        .filter((c) => c.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((c) => c.name);
      const t = quote(table);
      if (!keys.length) {
        await db.run(`DELETE FROM ${t}`);
      } else {
        // Rows the backup doesn't have go; the rest are updated in place, keeping any newer columns.
        const keep = new Set(rows.map((r) => JSON.stringify(keys.map((k) => r[k] ?? null))));
        const current = await db.getAll<Record<string, unknown>>(`SELECT ${keys.map(quote).join(', ')} FROM ${t}`);
        for (const row of current) {
          if (keep.has(JSON.stringify(keys.map((k) => row[k] ?? null)))) continue;
          await db.run(
            `DELETE FROM ${t} WHERE ${keys.map((k) => `${quote(k)} IS ?`).join(' AND ')}`,
            keys.map((k) => row[k]),
          );
        }
      }
      for (const row of rows) {
        const cols = Object.keys(row).filter((c) => columns.has(c));
        if (!cols.length) continue;
        const updates = cols.filter((c) => !keys.includes(c));
        const upsert =
          keys.length && keys.every((k) => cols.includes(k))
            ? ` ON CONFLICT (${keys.map(quote).join(', ')}) DO ${updates.length ? `UPDATE SET ${updates.map((c) => `${quote(c)} = excluded.${quote(c)}`).join(', ')}` : 'NOTHING'}`
            : '';
        await db.run(
          `INSERT INTO ${t} (${cols.map(quote).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})${upsert}`,
          cols.map((c) => row[c]),
        );
      }
    }
  });
}
