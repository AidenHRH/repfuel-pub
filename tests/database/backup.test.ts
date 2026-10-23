import { BackupError, exportBackup, parseBackup, restoreBackup } from '@/database/backup';
import { runMigrations } from '@/database/migrate';
import { allMigrations } from '@/database/migrations';
import { logClass, recentClasses } from '@/database/repositories/classRepository';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';
import { logLift, recentLifts } from '@/database/repositories/liftRepository';

import { createTestDb } from '../helpers/testDb';
import { migratedDb, seedRegulars } from '../helpers/seed';

const at = new Date('2026-10-22T12:00:00Z');

async function filledDb() {
  const db = await migratedDb();
  const { overnightOats } = await seedRegulars(db);
  await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at, 'breakfast');
  await logLift(db, { exerciseId: 'ex_barbell_bench_press', at, sets: [{ weightKg: 90, reps: 1, effort: 8 }] });
  await logClass(db, { classTypeId: 'class_hyrox', at, durationMin: 60, effort: 9, notes: 'Sled PB' });
  return db;
}

test('a backup restores everything onto a fresh phone', async () => {
  const file = await exportBackup(await filledDb(), at);
  expect(file).toMatchObject({
    app: 'RepFuel',
    schemaVersion: allMigrations[allMigrations.length - 1].version,
    exportedAt: at.toISOString(),
  });

  const fresh = await migratedDb();
  await restoreBackup(fresh, parseBackup(JSON.stringify(file)));
  expect(await entriesForDay(fresh, '2026-10-22')).toHaveLength(1);
  expect((await recentLifts(fresh))[0].sets).toEqual([{ weightKg: 90, reps: 1, effort: 8 }]);
  expect((await recentClasses(fresh))[0]).toMatchObject({ className: 'Hyrox', notes: 'Sled PB' });
});

test('a backup from a newer RepFuel is refused and nothing changes', async () => {
  const db = await filledDb();
  const file = { ...(await exportBackup(db, at)), schemaVersion: 99, tables: {} };
  await expect(restoreBackup(db, file)).rejects.toEqual(new BackupError('newer'));
  expect(await entriesForDay(db, '2026-10-22')).toHaveLength(1);
});

test('an older backup (before classes existed) restores, and classes still work', async () => {
  const old = createTestDb();
  await runMigrations(
    old,
    allMigrations.filter((m) => m.version <= 10),
  );
  const { overnightOats } = await seedRegulars(old);
  await logLoggable(old, { kind: 'recipe', id: overnightOats.id }, 1, at, 'breakfast');
  const file = await exportBackup(old, at);
  expect(file.schemaVersion).toBe(10);

  const db = await migratedDb();
  await restoreBackup(db, file);
  expect(await entriesForDay(db, '2026-10-22')).toHaveLength(1);
  // Tables the backup didn't have are left as they were: class types are still there.
  await logClass(db, { classTypeId: 'class_spin', at, durationMin: 45, effort: 6, notes: null });
  expect((await db.getFirst<{ tracking: string }>("SELECT tracking FROM exercise WHERE id = 'ex_plank'"))?.tracking).toBe('time');
});

test('anything that is not a RepFuel backup is refused', () => {
  for (const text of ['not json', '{"hello":1}', '[]', JSON.stringify({ app: 'Other', schemaVersion: 1, tables: {} })]) {
    expect(() => parseBackup(text)).toThrow(new BackupError('not_repfuel'));
  }
});
