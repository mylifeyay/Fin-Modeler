import { useCallback, useEffect, useRef, useState } from 'react';
import type { Plan } from '../engine/types';
import type { McMessage, McRequest } from '../workers/mc.worker';
import type { McState } from './context';

const IDLE: McState = { status: 'idle', progress: 0, result: null, stale: false };

/**
 * Runs the Monte Carlo simulation in a dedicated Web Worker and re-runs it,
 * debounced, whenever the plan changes. A run in flight is cancelled by
 * terminating its worker, so the UI thread never waits on the simulation.
 */
export function useMonteCarlo(plan: Plan, startYear: number, enabled: boolean): { mc: McState; run: (seed?: number) => void } {
  const [mc, setMc] = useState<McState>(IDLE);
  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const idRef = useRef(0);
  const planRef = useRef(plan);

  const start = useCallback(
    (p: Plan, seed: number) => {
      if (busyRef.current && workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('../workers/mc.worker.ts', import.meta.url), { type: 'module' });
      }
      const worker = workerRef.current;
      const id = ++idRef.current;
      busyRef.current = true;
      setMc((s) => ({ ...s, status: 'running', progress: 0, error: undefined }));
      worker.onmessage = (e: MessageEvent<McMessage>) => {
        const msg = e.data;
        if (msg.id !== idRef.current) return;
        if (msg.type === 'progress') {
          setMc((s) => ({ ...s, progress: msg.done / msg.total }));
        } else if (msg.type === 'done') {
          busyRef.current = false;
          setMc({ status: 'done', progress: 1, result: msg.result, stale: false });
        } else {
          busyRef.current = false;
          setMc((s) => ({ ...s, status: 'error', error: msg.message }));
        }
      };
      worker.onerror = () => {
        busyRef.current = false;
        setMc((s) => ({ ...s, status: 'error', error: 'The simulation worker stopped unexpectedly.' }));
      };
      const request: McRequest = { id, plan: p, startYear, runs: p.monteCarlo.runs, seed };
      worker.postMessage(request);
    },
    [startYear],
  );

  useEffect(() => {
    planRef.current = plan;
    if (!enabled) return;
    const timer = setTimeout(() => start(plan, plan.monteCarlo.seed), 450);
    const mark = setTimeout(() => setMc((s) => (s.result && !s.stale ? { ...s, stale: true } : s)), 0);
    return () => {
      clearTimeout(timer);
      clearTimeout(mark);
    };
  }, [plan, enabled, start]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const run = useCallback((seed?: number) => start(planRef.current, seed ?? planRef.current.monteCarlo.seed), [start]);
  return { mc, run };
}
