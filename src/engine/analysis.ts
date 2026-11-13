import { project, splitSale, tenancyEndYear } from './simulate';
import type { Plan, Projection, YearRow } from './types';

export type BridgeStatus = 'none' | 'funded' | 'tight' | 'fails';

export interface BridgeAnalysis {
  status: BridgeStatus;
  fromAge: number;
  toAge: number;
  years: number;
  rows: YearRow[];
  /** Accessible net worth on the day work stops. */
  accessibleAtStart: number;
  /** Sum of yearly deficits that accessible assets must fund. */
  totalDraw: number;
  totalSpend: number;
  totalPassiveIncome: number;
  minAccessible: number;
  minAccessibleAge: number;
  /** Accessible net worth at the end of the last bridge year. */
  accessibleAtEnd: number;
  /** Statutory money that turns accessible on the unlock birthday. */
  unlockedAtEnd: number;
  shortfall: number;
  firstShortfallAge: number | null;
  /** accessibleAtStart / totalDraw. Infinity when nothing is drawn. */
  coverage: number;
  /** Lowest point expressed in years of bridge spending. */
  runwayAtLow: number;
}

/** The years between stopping work and the statutory unlock age. */
export function analyzeBridge(plan: Plan, projection: Projection): BridgeAnalysis {
  const { currentAge, retireAge } = plan.profile;
  const st = plan.statutory;
  const fromAge = Math.max(retireAge, currentAge);
  const toAge = st.unlockAge;
  const rows = st.enabled ? projection.rows.filter((r) => r.age >= fromAge && r.age < toAge) : [];
  const empty: BridgeAnalysis = {
    status: 'none',
    fromAge,
    toAge,
    years: 0,
    rows: [],
    accessibleAtStart: 0,
    totalDraw: 0,
    totalSpend: 0,
    totalPassiveIncome: 0,
    minAccessible: 0,
    minAccessibleAge: fromAge,
    accessibleAtEnd: 0,
    unlockedAtEnd: 0,
    shortfall: 0,
    firstShortfallAge: null,
    coverage: Infinity,
    runwayAtLow: Infinity,
  };
  if (rows.length === 0) return empty;

  let totalDraw = 0;
  let totalSpend = 0;
  let totalPassive = 0;
  let shortfall = 0;
  let firstShortfallAge: number | null = null;
  let minAccessible = rows[0].accessibleOpen;
  let minAge = rows[0].age;
  for (const r of rows) {
    totalDraw += Math.max(0, -r.netCashFlow);
    totalSpend += r.living + r.oneOff + r.mortgageCash + r.tax;
    totalPassive += r.rentNet + r.dividends + r.secondary + r.deferredWithdrawal + r.statutoryPayout;
    shortfall += r.shortfall;
    if (r.shortfall > 0 && firstShortfallAge === null) firstShortfallAge = r.age;
    if (r.accessible < minAccessible) {
      minAccessible = r.accessible;
      minAge = r.age + 1;
    }
  }
  const last = rows[rows.length - 1];
  const next = projection.rows.find((r) => r.age === toAge);
  const avgSpend = totalSpend / rows.length;
  const runwayAtLow = avgSpend > 0 ? minAccessible / avgSpend : Infinity;
  const status: BridgeStatus = shortfall > 0 ? 'fails' : runwayAtLow < 2 ? 'tight' : 'funded';
  return {
    status,
    fromAge,
    toAge,
    years: rows.length,
    rows,
    accessibleAtStart: rows[0].accessibleOpen,
    totalDraw,
    totalSpend,
    totalPassiveIncome: totalPassive,
    minAccessible,
    minAccessibleAge: minAge,
    accessibleAtEnd: last.accessible,
    unlockedAtEnd: next ? next.accessibleOpen - last.accessible : 0,
    shortfall,
    firstShortfallAge,
    coverage: totalDraw > 0 ? rows[0].accessibleOpen / totalDraw : Infinity,
    runwayAtLow,
  };
}

export interface SaleScheduleRow {
  year: number;
  age: number;
  /** The tenancy lock-in still applies: a sale is not possible this year. */
  locked: boolean;
  value: number;
  sellingCosts: number;
  mortgage: number;
  netProceeds: number;
  housingPrincipal: number;
  housingAccrued: number;
  refund: number;
  freeCash: number;
  inflClose: number;
}

/** Net proceeds and their split for a sale at the end of each year, on the hold path. */
export function saleSchedule(plan: Plan, startYear: number): SaleScheduleRow[] {
  if (!plan.property.enabled) return [];
  const hold: Plan = { ...plan, property: { ...plan.property, sell: false } };
  const lockYear = tenancyEndYear(plan);
  return project(hold, startYear).rows.map((r) => {
    const s = splitSale(r.propValue, plan.property.sellingCostPct, r.mortgage, r.housingPrincipal, r.housingAccrued, plan.statutory.enabled);
    return {
      year: r.year,
      age: r.age,
      locked: r.year < lockYear,
      value: r.propValue,
      sellingCosts: s.sellingCosts,
      mortgage: r.mortgage,
      netProceeds: s.netProceeds,
      housingPrincipal: r.housingPrincipal,
      housingAccrued: r.housingAccrued,
      refund: s.refund,
      freeCash: s.freeCash,
      inflClose: r.inflClose,
    };
  });
}

export interface HoldSellComparison {
  saleYear: number;
  saleAge: number;
  hold: Projection;
  sell: Projection;
  sale: SaleScheduleRow | null;
  milestones: { age: number; holdAccessible: number; sellAccessible: number; holdHeadline: number; sellHeadline: number; infl: number }[];
}

/** Sell at the chosen year versus hold to the end of the plan. */
export function compareHoldSell(plan: Plan, startYear: number, saleYear?: number): HoldSellComparison | null {
  if (!plan.property.enabled) return null;
  const year = Math.max(saleYear ?? plan.property.sellYear, tenancyEndYear(plan), startYear);
  const hold = project({ ...plan, property: { ...plan.property, sell: false } }, startYear);
  const sell = project({ ...plan, property: { ...plan.property, sell: true, sellYear: year } }, startYear);
  const sale = saleSchedule(plan, startYear).find((r) => r.year === year) ?? null;
  const { currentAge, endAge } = plan.profile;
  const wanted = [year - startYear + currentAge + 1, plan.statutory.unlockAge, plan.statutory.payoutAge, 80, endAge];
  const ages = [...new Set(wanted)].filter((a) => a > currentAge && a <= endAge).sort((a, b) => a - b);
  const milestones = ages.map((age) => {
    const i = age - currentAge;
    return {
      age,
      holdAccessible: hold.accessible[i],
      sellAccessible: sell.accessible[i],
      holdHeadline: hold.headline[i],
      sellHeadline: sell.headline[i],
      infl: hold.inflIndex[i],
    };
  });
  return { saleYear: year, saleAge: year - startYear + currentAge, hold, sell, sale, milestones };
}
