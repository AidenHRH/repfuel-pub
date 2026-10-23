import * as SplashScreen from 'expo-splash-screen';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, spacing } from '@/theme/tokens';

import type { Db } from './Db';
import { openExpoDb } from './expoDb';
import { runMigrations } from './migrate';

type State = { status: 'loading' } | { status: 'ready'; db: Db } | { status: 'error'; error: Error };

const DbContext = createContext<Db | null>(null);

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used inside DatabaseProvider');
  return db;
}

async function openAndMigrate(): Promise<Db> {
  const db = await openExpoDb();
  await runMigrations(db);
  return db;
}

/** Opens the on-device database and brings its schema up to date before showing the app. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    openAndMigrate().then(
      (db) => {
        if (!cancelled) setState({ status: 'ready', db });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
        void SplashScreen.hideAsync();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === 'ready') return <DbContext.Provider value={state.db}>{children}</DbContext.Provider>;
  if (state.status === 'error') {
    const retry = () => {
      setState({ status: 'loading' });
      setAttempt((n) => n + 1);
    };
    return <DatabaseError error={state.error} onRetry={retry} />;
  }
  return <Blank />;
}

function Blank() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}

function DatabaseError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: layout.gutter,
        gap: spacing.sm,
      }}>
      <Text variant="title" style={{ textAlign: 'center' }}>
        RepFuel couldn&apos;t open your data
      </Text>
      <Text variant="callout" color="text2" style={{ textAlign: 'center' }}>
        Nothing has been deleted. Try again, and if it keeps happening, restart your phone.
      </Text>
      <Text variant="caption" color="text2" style={{ textAlign: 'center' }}>
        {error.message}
      </Text>
      <Button label="Try again" onPress={onRetry} style={{ marginTop: spacing.lg }} />
    </View>
  );
}
