import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Modal } from 'react-native';

import { useDb } from '@/database/DatabaseProvider';
import { getSetup } from '@/database/repositories/setupRepository';

import { Welcome } from './Welcome';

/** True once this phone has been set up; null while it's being checked. */
const SetupContext = createContext<boolean | null>(true);

export const useSetupDone = () => useContext(SetupContext);

/** Shows the welcome setup over the app on a phone that hasn't been set up yet. */
export function SetupGate({ children }: { children: ReactNode }) {
  const db = useDb();
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSetup(db).then(
      (s) => !cancelled && setDone(s.done),
      // Unreadable settings shouldn't lock the app behind the welcome.
      () => !cancelled && setDone(true),
    );
    return () => {
      cancelled = true;
    };
  }, [db]);
  const finish = useCallback(() => setDone(true), []);

  return (
    <SetupContext.Provider value={done}>
      {children}
      <Modal visible={done === false} animationType="fade" onRequestClose={() => undefined}>
        <Welcome onDone={finish} />
      </Modal>
    </SetupContext.Provider>
  );
}
