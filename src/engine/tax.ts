import type { TaxBracket } from './types';

export interface TaxBandLine {
  from: number;
  to: number | null;
  rate: number;
  taxable: number;
  tax: number;
}

/** Bands sorted by upper bound, open-ended band last. */
function ordered(brackets: TaxBracket[]): TaxBracket[] {
  return [...brackets].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
}

/** Progressive tax on chargeable income. Rates are in percent. */
export function progressiveTax(income: number, brackets: TaxBracket[]): number {
  if (!(income > 0)) return 0;
  let tax = 0;
  let floor = 0;
  for (const b of ordered(brackets)) {
    const ceil = b.upTo ?? Infinity;
    if (income <= floor) break;
    tax += (Math.min(income, ceil) - floor) * (b.rate / 100);
    floor = ceil;
  }
  return tax;
}

/** Band-by-band reconciliation for the detail view. */
export function taxBreakdown(income: number, brackets: TaxBracket[]): TaxBandLine[] {
  const lines: TaxBandLine[] = [];
  let floor = 0;
  for (const b of ordered(brackets)) {
    const ceil = b.upTo ?? Infinity;
    const taxable = Math.max(0, Math.min(income, ceil) - floor);
    lines.push({ from: floor, to: b.upTo, rate: b.rate, taxable, tax: taxable * (b.rate / 100) });
    floor = ceil;
    if (!Number.isFinite(ceil)) break;
  }
  return lines;
}

/** Marginal rate, in percent, at a given chargeable income. */
export function marginalRate(income: number, brackets: TaxBracket[]): number {
  for (const b of ordered(brackets)) {
    if (income < (b.upTo ?? Infinity)) return b.rate;
  }
  return 0;
}
