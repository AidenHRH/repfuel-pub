/**
 * The small slice of SQLite the app uses. The app runs it on expo-sqlite;
 * tests run it on better-sqlite3, so repositories are testable in Node.
 */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirst<T>(sql: string, params?: unknown[]): Promise<T | null>;
  /** Runs `fn` atomically: everything commits, or nothing does. */
  transaction(fn: () => Promise<void>): Promise<void>;
}
