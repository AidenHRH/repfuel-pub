import {
  addClassType,
  deleteClass,
  getClass,
  listClassTypes,
  logClass,
  recentClasses,
  updateClass,
} from '@/database/repositories/classRepository';

import { migratedDb } from '../helpers/seed';

const at = new Date('2026-10-20T18:30:00Z');

test('log a Hyrox session and read it back', async () => {
  const db = await migratedDb();
  const saved = await logClass(db, { classTypeId: 'class_hyrox', at, durationMin: 60, effort: 9, notes: 'PB on the sled push' });
  expect(saved).toMatchObject({
    classTypeId: 'class_hyrox',
    className: 'Hyrox',
    at: at.toISOString(),
    durationMin: 60,
    effort: 9,
    notes: 'PB on the sled push',
  });
  expect(await getClass(db, saved.id)).toEqual(saved);
});

test('blank notes are stored as none, and effort is optional', async () => {
  const db = await migratedDb();
  const saved = await logClass(db, { classTypeId: 'class_spin', at, durationMin: 45, effort: null, notes: '  ' });
  expect(saved).toMatchObject({ effort: null, notes: null });
});

test('impossible durations and efforts are refused', async () => {
  const db = await migratedDb();
  for (const durationMin of [0, 601, 12.5]) {
    await expect(logClass(db, { classTypeId: 'class_hiit', at, durationMin, effort: 5, notes: null })).rejects.toThrow(
      RangeError,
    );
  }
  for (const effort of [0, 11, 7.5]) {
    await expect(logClass(db, { classTypeId: 'class_hiit', at, durationMin: 30, effort, notes: null })).rejects.toThrow(
      RangeError,
    );
  }
  await expect(logClass(db, { classTypeId: 'nope', at, durationMin: 30, effort: 5, notes: null })).rejects.toThrow();
});

test('edit and delete a session; the newest come first', async () => {
  const db = await migratedDb();
  const a = await logClass(db, { classTypeId: 'class_hyrox', at, durationMin: 60, effort: 8, notes: null });
  const b = await logClass(db, {
    classTypeId: 'class_run',
    at: new Date('2026-10-21T07:00:00Z'),
    durationMin: 30,
    effort: 6,
    notes: null,
  });
  expect((await recentClasses(db)).map((c) => c.id)).toEqual([b.id, a.id]);
  await updateClass(db, a.id, { classTypeId: 'class_hyrox', at, durationMin: 75, effort: 9, notes: 'Longer' });
  expect(await getClass(db, a.id)).toMatchObject({ durationMin: 75, effort: 9, notes: 'Longer' });
  await deleteClass(db, a.id);
  expect(await getClass(db, a.id)).toBeNull();
  expect(await recentClasses(db)).toHaveLength(1);
});

test('your own classes come after the built-in ones; the same name twice is refused', async () => {
  const db = await migratedDb();
  const yoga = await addClassType(db, '  Yoga ');
  expect(yoga).toMatchObject({ name: 'Yoga', isCustom: true });
  expect((await listClassTypes(db)).map((t) => t.name)).toEqual(['Hyrox', 'Spin', 'HIIT', 'Run', 'Yoga']);
  await expect(addClassType(db, 'hyrox')).rejects.toThrow('Hyrox is already a class');
  await expect(addClassType(db, '   ')).rejects.toThrow(RangeError);
});
