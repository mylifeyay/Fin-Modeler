/** Small, fast, seedable PRNG (mulberry32). Deterministic across devices. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal generator (Box-Muller, cached pair). */
export function normalGenerator(uniform: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u <= 1e-12) u = uniform();
    const v = uniform();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

/** Triangular distribution on [low, high] with the given mode. */
export function triangular(u: number, low: number, mode: number, high: number): number {
  const lo = Math.min(low, mode, high);
  const hi = Math.max(low, mode, high);
  const m = Math.min(Math.max(mode, lo), hi);
  if (hi - lo < 1e-12) return lo;
  const cut = (m - lo) / (hi - lo);
  return u < cut ? lo + Math.sqrt(u * (hi - lo) * (m - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - m));
}

/**
 * One year of a lognormal return whose median equals `expected`.
 *
 * The plan's "expected return" is read as a compound (geometric) rate, so the
 * median stochastic path compounds at the same rate as the deterministic
 * projection and the two stay comparable. `expected` and `vol` are fractions.
 * `z` is a standard normal draw.
 */
export function lognormalReturn(expected: number, vol: number, z: number): number {
  if (vol <= 0) return expected;
  const base = Math.max(1 + expected, 1e-6);
  const sigma = Math.sqrt(Math.log(1 + (vol * vol) / (base * base)));
  return Math.exp(Math.log(base) + sigma * z) - 1;
}
