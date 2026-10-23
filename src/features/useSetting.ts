import { useCallback, useEffect, useState } from 'react';

import { useDb } from '@/database/DatabaseProvider';
import { getSetting, setSetting } from '@/database/repositories/settingsRepository';

import { safely } from './safely';
import { settingsEvents } from './settingsEvents';

/** A saved setting that every screen using it sees change at once. `null` while loading. */
export function useSetting<T>(key: string, fallback: T): [T | null, (value: T) => void] {
  const db = useDb();
  const [value, setValue] = useState<T | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => settingsEvents.subscribe((changed) => changed === key && setVersion((v) => v + 1)), [key]);

  useEffect(() => {
    let cancelled = false;
    getSetting(db, key, fallback).then(
      (v) => !cancelled && setValue(v),
      () => !cancelled && setValue(fallback),
    );
    return () => {
      cancelled = true;
    };
    // `fallback` is a constant default; reloading for a new identity isn't wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key, version]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      void safely('save that setting', async () => {
        await setSetting(db, key, next);
        settingsEvents.emit(key);
      });
    },
    [db, key],
  );
  return [value, update];
}
