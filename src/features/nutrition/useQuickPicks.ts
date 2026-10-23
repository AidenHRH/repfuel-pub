import { useEffect, useState } from 'react';

import type { Db } from '@/database/Db';
import { useDb } from '@/database/DatabaseProvider';
import { quickPicks } from '@/database/repositories/foodLogRepository';
import { drinkItems, favouriteItems, snackItems } from '@/database/repositories/snackRepository';
import type { Loggable } from '@/domain/types';

import { nutritionEvents } from './events';

/** One-tap items from `load`, refreshed whenever food data changes. */
function useLoggables(load: (db: Db) => Promise<Loggable[]>): Loggable[] | null {
  const db = useDb();
  const [version, setVersion] = useState(0);
  const [items, setItems] = useState<Loggable[] | null>(null);

  useEffect(() => nutritionEvents.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    load(db).then(
      (loaded) => {
        if (!cancelled) setItems(loaded);
      },
      () => {
        // These rows are shortcuts; if they can't load, Today still works without them.
        if (!cancelled) setItems([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, load, version]);

  return items;
}

/** My meals: saved foods and meals for one-tap logging. */
export function useQuickPicks(): Loggable[] | null {
  return useLoggables(quickPicks);
}

/** The Snacks tiles. */
export function useSnackItems(): Loggable[] | null {
  return useLoggables(snackItems);
}

/** The Drinks tiles. */
export function useDrinkItems(): Loggable[] | null {
  return useLoggables(drinkItems);
}

/** The Favourites tiles. */
export function useFavouriteItems(): Loggable[] | null {
  return useLoggables(favouriteItems);
}
