const MINUS = '−';

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');
}

/** Compact money: 950, 12.3K, 846K, 1.24M, 2.1B. */
export function compact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const a = Math.abs(value);
  const sign = value < 0 && a >= 0.5 ? MINUS : '';
  if (a >= 1e9) return `${sign}${trim(a / 1e9, 2)}B`;
  if (a >= 1e7) return `${sign}${trim(a / 1e6, 1)}M`;
  if (a >= 1e6) return `${sign}${trim(a / 1e6, 2)}M`;
  if (a >= 1e5) return `${sign}${Math.round(a / 1e3)}K`;
  if (a >= 1e4) return `${sign}${trim(a / 1e3, 1)}K`;
  return `${sign}${Math.round(a).toLocaleString('en-US')}`;
}

export function full(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const r = Math.round(value);
  return `${r < 0 ? MINUS : ''}${Math.abs(r).toLocaleString('en-US')}`;
}

export function money(value: number, opts: { compact?: boolean; sign?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const body = opts.compact ? compact(Math.abs(value)) : full(Math.abs(value));
  const negative = value < 0 && Math.abs(value) >= 0.5;
  const sign = negative ? MINUS : opts.sign && value > 0 ? '+' : '';
  return `${sign}$${body}`;
}

export function percent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function ratio(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  return `${x >= 10 ? Math.round(x) : trim(x, 1)}×`;
}

/** Round axis ticks: 0 / 500K / 1M / 1.5M. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  return ticks;
}
