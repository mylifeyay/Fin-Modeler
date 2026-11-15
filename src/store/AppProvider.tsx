import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { analyzeBridge } from '../engine/analysis';
import { BLANK_LABEL, CUSTOM_LABEL, SAMPLE_LABEL, normalizePlan, samplePlan } from '../engine/defaults';
import { project } from '../engine/simulate';
import type { Plan } from '../engine/types';
import { useSystemDark } from '../hooks/useViewport';
import { kvGet, kvSet, prefs } from '../lib/storage';
import { AppContext, type AppState, type DetailId, type LockConfig, type Settings, type Tab } from './context';
import { useMonteCarlo } from './useMonteCarlo';

const START_YEAR = new Date().getFullYear();
const DEFAULT_LOCK: LockConfig = { autoLock: true };
const AUTO_LOCK_MS = 30_000;

function loadSettings(): Settings {
  const s = prefs.get<Partial<Settings>>('settings');
  return {
    theme: s?.theme === 'light' || s?.theme === 'dark' ? s.theme : 'system',
    privacy: s?.privacy === true,
    real: s?.real !== false,
  };
}

function loadLock(): LockConfig {
  const l = prefs.get<LockConfig>('lock');
  if (!l || typeof l !== 'object') return DEFAULT_LOCK;
  return {
    pin: l.pin && typeof l.pin.hash === 'string' && typeof l.pin.salt === 'string' ? l.pin : undefined,
    passkeyId: typeof l.passkeyId === 'string' ? l.passkeyId : undefined,
    autoLock: l.autoLock !== false,
  };
}

function editedLabel(label: string): string {
  if (label === SAMPLE_LABEL) return `${SAMPLE_LABEL} · edited`;
  if (label === BLANK_LABEL) return CUSTOM_LABEL;
  return label;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<Plan>(() => samplePlan(START_YEAR));
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [lock, setLockState] = useState<LockConfig>(loadLock);
  const [locked, setLocked] = useState<boolean>(() => {
    const l = loadLock();
    return Boolean(l.pin || l.passkeyId);
  });
  const [tab, setTabState] = useState<Tab>('overview');
  const [detail, setDetail] = useState<DetailId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [party, setParty] = useState(0);
  const celebrate = useCallback(() => setParty((n) => n + 1), []);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from on-device storage. First launch keeps the sample preset.
  useEffect(() => {
    let alive = true;
    kvGet<unknown>('plan')
      .then((stored) => {
        if (!alive) return;
        if (stored !== undefined) setPlan(normalizePlan(stored, START_YEAR));
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // Persist, debounced, after hydration.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void kvSet('plan', plan), 250);
    return () => clearTimeout(timer);
  }, [plan, ready]);

  const update = useCallback((mutate: (draft: Plan) => void) => {
    setPlan((prev) => {
      const draft = structuredClone(prev);
      mutate(draft);
      draft.label = editedLabel(draft.label);
      return draft;
    });
  }, []);

  const replacePlan = useCallback((next: Plan) => setPlan(normalizePlan(next, START_YEAR)), []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      prefs.set('settings', next);
      return next;
    });
  }, []);

  const setLock = useCallback((next: LockConfig) => {
    setLockState(next);
    prefs.set('lock', next);
  }, []);

  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    setDetail(null);
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Theme: resolve "system" and stamp the document so CSS tokens switch.
  const systemDark = useSystemDark();
  const dark = settings.theme === 'system' ? systemDark : settings.theme === 'dark';
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#07090d' : '#f1f1ee');
  }, [dark]);
  useEffect(() => {
    document.documentElement.classList.toggle('privacy', settings.privacy);
  }, [settings.privacy]);

  // Auto-lock after time in the background.
  const hasLock = Boolean(lock.pin || lock.passkeyId);
  useEffect(() => {
    if (!hasLock || !lock.autoLock) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [hasLock, lock.autoLock]);

  const projection = useMemo(() => project(plan, START_YEAR), [plan]);
  const bridge = useMemo(() => analyzeBridge(plan, projection), [plan, projection]);
  const { mc, run } = useMonteCarlo(plan, START_YEAR, ready && !locked);

  const runMc = useCallback(
    (newSeed?: boolean) => {
      if (newSeed) {
        const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
        setPlan((prev) => ({ ...prev, monteCarlo: { ...prev.monteCarlo, seed } }));
      } else {
        run();
      }
    },
    [run],
  );

  const value: AppState = {
    ready,
    startYear: START_YEAR,
    plan,
    update,
    replacePlan,
    settings,
    setSettings,
    lock,
    setLock,
    locked,
    setLocked,
    projection,
    bridge,
    mc,
    runMc,
    tab,
    setTab,
    detail,
    setDetail,
    notify,
    toast,
    wizard,
    setWizard,
    celebrate,
    party,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
