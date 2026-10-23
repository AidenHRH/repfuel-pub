import * as SQLite from 'expo-sqlite';

import type { Db } from './Db';

type Bindable = SQLite.SQLiteBindValue;

function bind(params: unknown[] = []): Bindable[] {
  return params.map((p) => (typeof p === 'boolean' ? Number(p) : (p as Bindable)));
}

export async function openExpoDb(name = 'repfuel.db'): Promise<Db> {
  const sqlite = await SQLite.openDatabaseAsync(name);
  await sqlite.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  return {
    exec: (sql) => sqlite.execAsync(sql),
    run: async (sql, params) => {
      const result = await sqlite.runAsync(sql, bind(params));
      return { changes: result.changes };
    },
    getAll: (sql, params) => sqlite.getAllAsync(sql, bind(params)),
    getFirst: (sql, params) => sqlite.getFirstAsync(sql, bind(params)),
    transaction: (fn) => sqlite.withTransactionAsync(fn),
  };
}
