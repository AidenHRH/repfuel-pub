import Database from 'better-sqlite3';

import type { Db } from '@/database/Db';

/** In-memory SQLite implementing the app's Db interface, so storage logic runs under Jest. */
export function createTestDb(): Db & { close(): void } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const bind = (params: unknown[] = []) => params.map((p) => (typeof p === 'boolean' ? Number(p) : p));

  return {
    async exec(sql) {
      sqlite.exec(sql);
    },
    async run(sql, params) {
      const result = sqlite.prepare(sql).run(...bind(params));
      return { changes: result.changes };
    },
    async getAll<T>(sql: string, params?: unknown[]) {
      return sqlite.prepare(sql).all(...bind(params)) as T[];
    },
    async getFirst<T>(sql: string, params?: unknown[]) {
      return (sqlite.prepare(sql).get(...bind(params)) as T | undefined) ?? null;
    },
    async transaction(fn) {
      sqlite.exec('BEGIN');
      try {
        await fn();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      sqlite.close();
    },
  };
}
