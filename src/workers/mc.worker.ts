/// <reference lib="webworker" />
import { runMonteCarlo } from '../engine/montecarlo';
import type { MonteCarloResult, Plan } from '../engine/types';

export interface McRequest {
  id: number;
  plan: Plan;
  startYear: number;
  runs: number;
  seed: number;
}

export type McMessage =
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'done'; id: number; result: MonteCarloResult }
  | { type: 'error'; id: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<McRequest>) => {
  const { id, plan, startYear, runs, seed } = e.data;
  try {
    const result = runMonteCarlo(plan, startYear, runs, seed, (done, total) => {
      ctx.postMessage({ type: 'progress', id, done, total } satisfies McMessage);
    });
    ctx.postMessage({ type: 'done', id, result } satisfies McMessage);
  } catch (err) {
    ctx.postMessage({ type: 'error', id, message: err instanceof Error ? err.message : 'Simulation failed' } satisfies McMessage);
  }
};
