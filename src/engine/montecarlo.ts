import { lognormalReturn, mulberry32, normalGenerator, triangular } from './rng';
import { allocPathOut, horizonYears, runPath } from './simulate';
import type { HistogramBin, MonteCarloResult, PercentileBands, Plan, Sampler, YearDraw } from './types';

const pct = (x: number): number => (Number.isFinite(x) ? x / 100 : 0);

/** Stochastic yearly draws: lognormal asset returns, FX shocks, noisy inflation, random bonus. */
export function makeSampler(plan: Plan, uniform: () => number): Sampler {
  const normal = normalGenerator(uniform);
  const l = plan.liquid;
  const rho = Math.min(0.99, Math.max(-0.99, plan.macro.equityCorrelation));
  const rhoC = Math.sqrt(1 - rho * rho);
  const inc = plan.income;
  const draw: YearDraw = { rCash: 0, rDom: 0, rFor: 0, rBond: 0, rAlt: 0, rDeferred: 0, rProp: 0, fx: 0, inflation: 0, bonusMonths: 0 };
  return () => {
    const zDom = normal();
    const zFor = rho * zDom + rhoC * normal();
    draw.rCash = lognormalReturn(pct(l.cash.ret), pct(l.cash.vol), normal());
    draw.rDom = lognormalReturn(pct(l.domEq.ret), pct(l.domEq.vol), zDom);
    draw.rFor = lognormalReturn(pct(l.forEq.ret), pct(l.forEq.vol), zFor);
    draw.rBond = lognormalReturn(pct(l.bonds.ret), pct(l.bonds.vol), normal());
    draw.rAlt = lognormalReturn(pct(l.alt.ret), pct(l.alt.vol), normal());
    // The tax-deferred bucket is assumed to hold a diversified equity-like mix.
    draw.rDeferred = lognormalReturn(pct(plan.tax.deferredReturn), pct(plan.tax.deferredVol), 0.8 * zDom + 0.6 * normal());
    draw.rProp = lognormalReturn(pct(plan.property.appreciation), pct(plan.property.vol), normal());
    draw.fx = lognormalReturn(pct(l.forEq.fxDrift), pct(l.forEq.fxVol), normal());
    draw.inflation = Math.max(-0.03, pct(plan.macro.inflation) + pct(plan.macro.inflationVol) * normal());
    draw.bonusMonths = triangular(uniform(), inc.bonusLowMonths, inc.bonusBaseMonths, inc.bonusHighMonths);
    return draw;
  };
}

function quantileSorted(sorted: Float64Array, q: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const p = (n - 1) * q;
  const lo = Math.floor(p);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
}

function bands(columns: Float64Array[]): PercentileBands {
  const b: PercentileBands = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (const col of columns) {
    const s = col.slice().sort();
    b.p10.push(quantileSorted(s, 0.1));
    b.p25.push(quantileSorted(s, 0.25));
    b.p50.push(quantileSorted(s, 0.5));
    b.p75.push(quantileSorted(s, 0.75));
    b.p90.push(quantileSorted(s, 0.9));
  }
  return b;
}

/** Equal-width bins from the low end to the 90th percentile. The last bin also collects everything above it. */
function histogram(values: Float64Array, binCount: number): HistogramBin[] {
  const s = values.slice().sort();
  const lo = Math.min(0, quantileSorted(s, 0.01));
  const hi = quantileSorted(s, 0.9);
  if (!(hi > lo)) return [{ from: lo, to: lo, count: values.length }];
  const width = (hi - lo) / (binCount - 1);
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0 }));
  bins[binCount - 1].to = Math.max(bins[binCount - 1].to, s[s.length - 1]);
  for (let i = 0; i < values.length; i++) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((values[i] - lo) / width)));
    bins[idx].count++;
  }
  return bins;
}

/**
 * Run `runs` stochastic paths and summarise them. Pure and synchronous: the
 * worker calls this off the main thread, tests call it directly.
 */
export function runMonteCarlo(
  plan: Plan,
  startYear: number,
  runs: number,
  seed: number,
  onProgress?: (done: number, total: number) => void,
): MonteCarloResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const n = horizonYears(plan);
  const total = Math.max(1, Math.round(runs));
  const uniform = mulberry32(seed);
  const out = allocPathOut(n);
  const cols = (): Float64Array[] => Array.from({ length: n + 1 }, () => new Float64Array(total));
  const accNom = cols();
  const accReal = cols();
  const headNom = cols();
  const headReal = cols();
  const endingReal = new Float64Array(total);
  const depletionByAge = new Array<number>(n + 1).fill(0);

  const { currentAge, retireAge } = plan.profile;
  const st = plan.statutory;
  const bridgeFrom = Math.max(retireAge, currentAge) - currentAge;
  const bridgeTo = Math.min(n, st.unlockAge - currentAge);
  const hasBridge = st.enabled && bridgeTo > bridgeFrom;

  let success = 0;
  let bridgeOk = 0;
  const step = Math.max(50, Math.floor(total / 20));

  for (let i = 0; i < total; i++) {
    runPath(plan, startYear, makeSampler(plan, uniform), out);
    for (let t = 0; t <= n; t++) {
      const idx = out.infl[t] > 0 ? out.infl[t] : 1;
      accNom[t][i] = out.accessible[t];
      accReal[t][i] = out.accessible[t] / idx;
      headNom[t][i] = out.headline[t];
      headReal[t][i] = out.headline[t] / idx;
    }
    endingReal[i] = accReal[n][i];
    let firstDry = -1;
    let bridgeDry = false;
    for (let t = 0; t < n; t++) {
      if (out.shortfall[t] > 0) {
        if (firstDry < 0) firstDry = t;
        if (t >= bridgeFrom && t < bridgeTo) bridgeDry = true;
      }
    }
    if (firstDry < 0) success++;
    else depletionByAge[firstDry]++;
    if (!bridgeDry) bridgeOk++;
    if (onProgress && (i + 1) % step === 0) onProgress(i + 1, total);
  }

  const endSorted = endingReal.slice().sort();
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    runs: total,
    ages: Array.from({ length: n + 1 }, (_, i) => Math.round(currentAge) + i),
    accessible: { nominal: bands(accNom), real: bands(accReal) },
    headline: { nominal: bands(headNom), real: bands(headReal) },
    successRate: success / total,
    bridgeSurvival: hasBridge ? bridgeOk / total : null,
    depletionByAge,
    endingReal: histogram(endingReal, 24),
    endingRealMedian: quantileSorted(endSorted, 0.5),
    endingRealP10: quantileSorted(endSorted, 0.1),
    endingRealP90: quantileSorted(endSorted, 0.9),
    elapsedMs: t1 - t0,
  };
}
