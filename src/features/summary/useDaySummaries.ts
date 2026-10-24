import { useEffect, useState } from 'react';

import { useDb } from '@/database/DatabaseProvider';
import { daySummaries, type DaySummary } from '@/database/repositories/dayRepository';
import { nutritionEvents } from '@/features/nutrition/events';

/** Summaries for `days` (in order), refreshed whenever food changes; null while loading. */
export function useDaySummaries(days: string[], version = 0): DaySummary[] | null {
  const db = useDb();
  const [ownVersion, setOwnVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; list: DaySummary[] } | null>(null);
  const key = days.join(',');

  useEffect(() => nutritionEvents.subscribe(() => setOwnVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    daySummaries(db, key.split(',')).then(
      (list) => !cancelled && setLoaded({ key, list }),
      () => !cancelled && setLoaded({ key, list: [] }),
    );
    return () => {
      cancelled = true;
    };
  }, [db, key, version, ownVersion]);

  return loaded?.key === key ? loaded.list : null;
}
