import { createContext, useContext } from 'react';
import type { BridgeAnalysis } from '../engine/analysis';
import type { MonteCarloResult, Plan, Projection } from '../engine/types';
import type { PinRecord } from '../security/crypto';

export type Tab = 'overview' | 'plan' | 'simulate' | 'ledger' | 'vault';

export type DetailId =
  | 'networth'
  | 'bridge'
  | 'success'
  | 'property'
  | 'locked'
  | 'cashflow'
  | 'tax'
  | 'ledger'
  | 'edit-profile'
  | 'edit-liquid'
  | 'edit-statutory'
  | 'edit-property'
  | 'edit-income'
  | 'edit-tax'
  | 'edit-expenses'
  | 'about';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeChoice;
  /** Blur every monetary value on screen. */
  privacy: boolean;
  /** Show today's dollars (inflation-adjusted) instead of nominal. */
  real: boolean;
}

export interface LockConfig {
  pin?: PinRecord;
  passkeyId?: string;
  /** Lock again after the app has been in the background. */
  autoLock: boolean;
}

export interface McState {
  status: 'idle' | 'running' | 'done' | 'error';
  progress: number;
  result: MonteCarloResult | null;
  /** The plan changed after `result` was computed. */
  stale: boolean;
  error?: string;
}

export interface AppState {
  ready: boolean;
  startYear: number;
  plan: Plan;
  /** Mutate a draft copy of the plan. */
  update: (mutate: (draft: Plan) => void) => void;
  replacePlan: (plan: Plan) => void;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  lock: LockConfig;
  setLock: (lock: LockConfig) => void;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  projection: Projection;
  bridge: BridgeAnalysis;
  mc: McState;
  runMc: (newSeed?: boolean) => void;
  tab: Tab;
  setTab: (tab: Tab) => void;
  detail: DetailId | null;
  setDetail: (detail: DetailId | null) => void;
  notify: (message: string) => void;
  toast: string | null;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Deflate a nominal amount by a price index when the "today's dollars" view is on. */
export function useAdjust(): (value: number, index: number) => number {
  const { settings } = useApp();
  const real = settings.real;
  return (value, index) => (real && index > 0 ? value / index : value);
}
