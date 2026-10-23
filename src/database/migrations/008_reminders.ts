import type { Migration } from './index';

// Daily reminders (creatine first) and the days they were ticked off.
export const reminders: Migration = {
  version: 8,
  name: 'reminders',
  async up(db) {
    await db.exec(`
CREATE TABLE reminder (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  hour INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute INTEGER NOT NULL CHECK (minute BETWEEN 0 AND 59),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1))
);
CREATE TABLE reminder_done (
  reminder_id TEXT NOT NULL REFERENCES reminder (id) ON DELETE CASCADE,
  local_day TEXT NOT NULL CHECK (local_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  done_at TEXT NOT NULL,
  PRIMARY KEY (reminder_id, local_day)
);
INSERT INTO reminder (id, name, message, hour, minute, enabled)
VALUES ('creatine', 'Creatine', 'Time to take your creatine.', 8, 0, 0);
`);
  },
};
