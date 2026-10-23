import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useDb } from '@/database/DatabaseProvider';
import { getTourState, saveTourState, tipFacts } from '@/database/repositories/tourRepository';
import { useSetupDone } from '@/features/setup/SetupGate';
import { canShowTip, tipWanted, type TipId } from '@/domain/tips';

import { measureTarget, type Rect, type TargetView } from './measure';
import { TOUR_PRODUCT, TOUR_STEPS, type Place, type TargetId } from './steps';
import { TIPS, type Tip } from './tips';
import { TourOverlay, type Spotlight } from './TourOverlay';

const FIND_FOR_MS = 2000;
const LOOK_EVERY_MS = 100;
const TIP_SETTLE_MS = 300;

type TourContextValue = {
  register: (id: TargetId, view: TargetView | null) => void;
  relayout: (id: TargetId) => void;
  start: () => void;
  setTipsOn: (on: boolean) => Promise<void>;
  running: boolean;
};

export const TourContext = createContext<TourContextValue | null>(null);

/** The tour's controls, for Settings. */
export function useTour(): Pick<TourContextValue, 'start' | 'setTipsOn' | 'running'> {
  const ctx = useContext(TourContext);
  return {
    start: ctx?.start ?? (() => undefined),
    setTipsOn: ctx?.setTipsOn ?? (async () => undefined),
    running: ctx?.running ?? false,
  };
}

/** Opens the screens a stop is on, from where the tour is now. */
function goTo(from: Place, to: Place) {
  if (from === to) return;
  if (from === 'log-food' || from === 'product') {
    if (to === 'log-food') router.back();
    else router.dismissAll();
  }
  if (from === 'settings' && to !== 'settings') router.navigate('/');
  if (to === 'log-food' && from !== 'product') router.push('/log-food');
  if (to === 'product') {
    if (from !== 'log-food') router.push('/log-food');
    router.push(TOUR_PRODUCT);
  }
  if (to === 'settings') router.navigate('/settings');
}

/**
 * The first-run tour: shown once (on the first open of a version that has it, or from Settings), one stop at a time
 * over the real buttons. It opens Log food and a product itself and closes them at the end; it never logs anything.
 * Done or Skip marks it seen, so an app closed mid-tour shows it again.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const targets = useRef(new Map<TargetId, TargetView>());
  const place = useRef<Place>('summary');
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  // Bumped when the current stop's target appears or moves, so it is measured again.
  const [layoutTick, setLayoutTick] = useState(0);
  const step = index === null ? null : TOUR_STEPS[index];
  const [tip, setTip] = useState<{ tip: Tip; rect: Rect } | null>(null);
  // One tip check at a time, so two targets appearing together can't both show one.
  const checkingTip = useRef(false);
  const running = index !== null;
  // Read by tip checks without making every target re-register when they change.
  const busy = useRef(false);
  useEffect(() => {
    busy.current = running || tip !== null;
  }, [running, tip]);
  // Tips seen this session, counted at once rather than when the save lands.
  const seen = useRef<{ shown: TipId[]; lastTipAt: string | null }>({ shown: [], lastTipAt: null });

  // The tour waits for the welcome setup on a new phone.
  const setupDone = useSetupDone();
  useEffect(() => {
    if (!setupDone) return;
    let cancelled = false;
    getTourState(db).then(
      (state) => {
        if (!cancelled && !state.doneAt) setIndex(0);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [db, setupDone]);

  const finish = useCallback(() => {
    const from = place.current;
    place.current = 'summary';
    setIndex(null);
    setRect(null);
    goTo(from, 'summary');
    void saveTourState(db, { doneAt: new Date().toISOString() }).catch(() => undefined);
  }, [db]);

  const next = useCallback(() => {
    if (index === null) return;
    if (index >= TOUR_STEPS.length - 1) return finish();
    setRect(null);
    setIndex(index + 1);
  }, [index, finish]);

  // Move to the stop's screen.
  useEffect(() => {
    if (!step) return;
    goTo(place.current, step.place);
    place.current = step.place;
  }, [step]);

  // Find the stop's target; skip the stop if it isn't on screen within 2 seconds.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const look = async () => {
      const view = targets.current.get(step.target);
      const found = view ? await measureTarget(view, step.target) : null;
      if (cancelled) return;
      if (found) setRect(found);
      else if (Date.now() - started >= FIND_FOR_MS) next();
      else timer = setTimeout(() => void look(), LOOK_EVERY_MS);
    };
    timer = setTimeout(() => void look(), LOOK_EVERY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- looks again per stop and when its target moves
  }, [step, layoutTick]);

  // A tip's target has appeared: once its screen has settled, offer the first tip (in list order) whose target is on
  // screen, if it has something to teach and the pacing allows.
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTips = useCallback(async () => {
    if (checkingTip.current || busy.current) return;
    const onScreen = TIPS.filter((t) => targets.current.has(t.target));
    if (!onScreen.length) return;
    checkingTip.current = true;
    try {
      const now = new Date();
      const [saved, facts] = await Promise.all([getTourState(db), tipFacts(db)]);
      const state = {
        ...saved,
        shown: [...saved.shown, ...seen.current.shown],
        lastTipAt: seen.current.lastTipAt ?? saved.lastTipAt,
      };
      const chosen = onScreen.find((t) => canShowTip(t.id, state, now) && tipWanted(t.id, facts, now));
      const view = chosen && targets.current.get(chosen.target);
      const found = chosen && view ? await measureTarget(view, chosen.target) : null;
      if (chosen && found && targets.current.get(chosen.target) === view && !busy.current) setTip({ tip: chosen, rect: found });
    } catch {
      // Tips are extras; if they can't load, the screen works without one.
    } finally {
      checkingTip.current = false;
    }
  }, [db]);
  const offerTip = useCallback(
    (id: TargetId) => {
      if (!TIPS.some((t) => t.target === id)) return;
      if (tipTimer.current) clearTimeout(tipTimer.current);
      tipTimer.current = setTimeout(() => void checkTips(), TIP_SETTLE_MS);
    },
    [checkTips],
  );
  useEffect(
    () => () => {
      if (tipTimer.current) clearTimeout(tipTimer.current);
    },
    [],
  );

  const register = useCallback(
    (id: TargetId, view: TargetView | null) => {
      if (view) targets.current.set(id, view);
      else targets.current.delete(id);
      if (view && id === step?.target) setLayoutTick((t) => t + 1);
      if (view && !step) offerTip(id);
      // Its screen closed: the tip goes with it, unseen, so it can come back.
      if (!view) setTip((current) => (current?.tip.target === id ? null : current));
    },
    [step, offerTip],
  );

  const dismissTip = useCallback(
    (id: TipId) => {
      setTip(null);
      const lastTipAt = new Date().toISOString();
      seen.current = { shown: [...seen.current.shown, id], lastTipAt };
      void getTourState(db)
        .then((state) => saveTourState(db, { shown: [...state.shown, id], lastTipAt }))
        .catch(() => undefined);
    },
    [db],
  );
  const relayout = useCallback(
    (id: TargetId) => {
      if (id === step?.target) setLayoutTick((t) => t + 1);
    },
    [step],
  );
  // Helpful tips off, or on again: on again lets seen tips come back (still one every few days).
  const setTipsOn = useCallback(
    async (on: boolean) => {
      if (on) seen.current = { ...seen.current, shown: [] };
      else setTip(null);
      await saveTourState(db, on ? { tipsOn: true, shown: [] } : { tipsOn: false });
    },
    [db],
  );

  const start = useCallback(() => {
    setTip(null);
    router.navigate('/');
    place.current = 'summary';
    setRect(null);
    setIndex(0);
  }, []);

  const value = useMemo(
    () => ({ register, relayout, start, setTipsOn, running }),
    [register, relayout, start, setTipsOn, running],
  );

  const spot: Spotlight | null =
    step && rect && index !== null
      ? {
          kind: 'Tour',
          rect,
          title: step.title,
          text: step.text,
          counter: `${index + 1} of ${TOUR_STEPS.length}`,
          primary: { label: index === TOUR_STEPS.length - 1 ? 'Done' : 'Next', onPress: next },
          secondary: { label: 'Skip tour', onPress: finish },
        }
      : tip
        ? {
            kind: 'Tip',
            rect: tip.rect,
            title: tip.tip.title,
            text: tip.tip.text,
            primary: { label: 'Got it', onPress: () => dismissTip(tip.tip.id) },
          }
        : null;

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourOverlay spot={spot} />
    </TourContext.Provider>
  );
}
