import type { Migration } from './index';

// The welcome setup arrived in 0.20. A phone that already has logs, workouts or meals was set up before it, so it
// skips the welcome; a new install (nothing logged yet) gets it.
export const setupDone: Migration = {
  version: 18,
  name: 'setup_done',
  async up(db) {
    const used = await db.getFirst<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM food_log_entry) + (SELECT COUNT(*) FROM workout) + (SELECT COUNT(*) FROM recipe) AS n`,
    );
    if (used && used.n > 0) {
      await db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('setup', '{"done":true}')`);
    }
  },
};
