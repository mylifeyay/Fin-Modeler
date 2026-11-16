import type { Plan, TaxBracket } from './types';

export const SAMPLE_LABEL = 'Sample Preset';
export const BLANK_LABEL = 'Blank';
export const CUSTOM_LABEL = 'My Plan';

/** Illustrative resident progressive income-tax bands. Editable in the app. */
const BRACKETS: TaxBracket[] = [
  { upTo: 20_000, rate: 0 },
  { upTo: 30_000, rate: 2 },
  { upTo: 40_000, rate: 3.5 },
  { upTo: 80_000, rate: 7 },
  { upTo: 120_000, rate: 11.5 },
  { upTo: 160_000, rate: 15 },
  { upTo: 200_000, rate: 18 },
  { upTo: 240_000, rate: 19 },
  { upTo: 280_000, rate: 19.5 },
  { upTo: 320_000, rate: 20 },
  { upTo: 500_000, rate: 22 },
  { upTo: 1_000_000, rate: 23 },
  { upTo: null, rate: 24 },
];

/**
 * Generic, round-number demonstration plan. Nothing here describes a real
 * person. Dates are derived from the current year so the demo never goes stale.
 */
export function samplePlan(year: number): Plan {
  return {
    schema: 1,
    label: SAMPLE_LABEL,
    baseCurrency: 'SGD',
    profile: { currentAge: 35, retireAge: 48, endAge: 95 },
    macro: { inflation: 2.5, inflationVol: 1, equityCorrelation: 0.7 },
    liquid: {
      cash: { balance: 100_000, ret: 2.5, vol: 0.5, yieldPct: 0, savePct: 10 },
      domEq: { balance: 150_000, ret: 6, vol: 15, yieldPct: 3.5, savePct: 30 },
      forEq: { balance: 150_000, ret: 7, vol: 17, yieldPct: 1.5, savePct: 45, currency: 'USD', fxRate: 1.3, fxDrift: -0.5, fxVol: 6 },
      bonds: { balance: 80_000, ret: 3.5, vol: 5, yieldPct: 3, savePct: 15 },
      alt: { balance: 30_000, ret: 6, vol: 45, yieldPct: 0, savePct: 0, haircut: 30 },
    },
    drawStrategy: 'sequential',
    statutory: {
      enabled: true,
      oa: 120_000,
      sa: 80_000,
      ma: 60_000,
      ra: 0,
      oaRate: 2.5,
      saRate: 4,
      maRate: 4,
      maCap: 80_000,
      maCapGrowth: 4,
      unlockAge: 55,
      frs: 220_000,
      frsGrowth: 3.5,
      ersMultiple: 2,
      lockIn: 'FRS',
      payoutAge: 65,
      payoutRate: 6.3,
      employeeRate: 20,
      employerRate: 17,
      oaShare: 62,
      saShare: 16,
      maShare: 22,
      wageCeilingMonthly: 8_000,
      wageCeilingAnnual: 102_000,
    },
    property: {
      enabled: true,
      purchaseCost: 1_200_000,
      marketValue: 1_400_000,
      appreciation: 2.5,
      vol: 8,
      mortgageBalance: 600_000,
      mortgageRate: 3,
      mortgageYearsLeft: 20,
      oaSharePct: 50,
      monthlyRent: 4_500,
      rentGrowth: 2,
      propertyTaxAnnual: 6_000,
      maintenanceMonthly: 400,
      vacancyPct: 5,
      agentFeePct: 4,
      tenancyEnd: `${year + 2}-06`,
      cpfPrincipalUsed: 150_000,
      cpfAccruedInterest: 20_000,
      accruedRate: 2.5,
      sellingCostPct: 2,
      sell: false,
      sellYear: year + 2,
    },
    income: {
      salaryMonthly: 12_000,
      salaryIsGross: true,
      salaryGrowth: 3,
      bonusLowMonths: 1,
      bonusBaseMonths: 2.5,
      bonusHighMonths: 4,
      bonusScenario: 'base',
      secondaryAnnual: 12_000,
      secondaryDecay: 10,
      secondaryEndYear: year + 10,
    },
    tax: {
      brackets: BRACKETS.map((b) => ({ ...b })),
      reliefs: 5_000,
      deferredCap: 15_300,
      deferredContribution: 15_300,
      deferredBalance: 40_000,
      deferredReturn: 5,
      deferredVol: 10,
      deferredWithdrawAge: 63,
      deferredWithdrawYears: 10,
      deferredTaxablePct: 50,
    },
    expenses: {
      baseMonthly: 5_000,
      discretionaryMonthly: 2_000,
      oneOffs: [
        { id: 'sample-vehicle', label: 'Vehicle replacement', year: year + 3, amount: 100_000, everyYears: 10, untilYear: year + 33, inflate: true },
        { id: 'sample-renovation', label: 'Home renovation', year: year + 8, amount: 50_000, everyYears: 0, untilYear: 0, inflate: true },
      ],
      retirementMode: 'multiplier',
      retirementMultiplier: 80,
      retirementCustomMonthly: 6_000,
      retirementExtraInflation: 0.5,
    },
    monteCarlo: { runs: 2000, seed: 12345 },
    breakdowns: {},
  };
}

/** Same assumptions and statutory rules, every personal figure zeroed. */
export function blankPlan(year: number): Plan {
  const s = samplePlan(year);
  const zero = <T extends { balance: number }>(b: T): T => ({ ...b, balance: 0 });
  return {
    ...s,
    label: BLANK_LABEL,
    liquid: { cash: zero(s.liquid.cash), domEq: zero(s.liquid.domEq), forEq: zero(s.liquid.forEq), bonds: zero(s.liquid.bonds), alt: zero(s.liquid.alt) },
    statutory: { ...s.statutory, oa: 0, sa: 0, ma: 0, ra: 0 },
    property: {
      ...s.property,
      enabled: false,
      purchaseCost: 0,
      marketValue: 0,
      mortgageBalance: 0,
      mortgageYearsLeft: 0,
      monthlyRent: 0,
      propertyTaxAnnual: 0,
      maintenanceMonthly: 0,
      cpfPrincipalUsed: 0,
      cpfAccruedInterest: 0,
      tenancyEnd: `${year}-01`,
      sell: false,
      sellYear: year,
    },
    income: { ...s.income, salaryMonthly: 0, bonusLowMonths: 0, bonusBaseMonths: 0, bonusHighMonths: 0, secondaryAnnual: 0, secondaryEndYear: 0 },
    tax: { ...s.tax, reliefs: 0, deferredContribution: 0, deferredBalance: 0 },
    expenses: { ...s.expenses, baseMonthly: 0, discretionaryMonthly: 0, oneOffs: [], retirementCustomMonthly: 0 },
    breakdowns: {},
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Copy `incoming` onto the shape of `base`, keeping only keys and types the schema knows. */
function conform<T>(base: T, incoming: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(incoming) ? incoming : base) as T;
  if (isObject(base)) {
    if (!isObject(incoming)) return base;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(base)) result[key] = conform((base as Record<string, unknown>)[key], incoming[key]);
    return result as T;
  }
  if (base === null) return (incoming === null || typeof incoming === 'number' ? incoming : base) as T;
  if (typeof base === 'number') return (typeof incoming === 'number' && Number.isFinite(incoming) ? incoming : base) as T;
  return (typeof incoming === typeof base ? incoming : base) as T;
}

/**
 * Validate anything read from storage or an imported file. Unknown keys are
 * dropped, missing or mistyped ones fall back to the blank plan.
 */
export function normalizePlan(input: unknown, year: number): Plan {
  const base = blankPlan(year);
  const plan = conform(base, input);
  plan.schema = 1;
  plan.tax.brackets = (Array.isArray(plan.tax.brackets) ? plan.tax.brackets : [])
    .filter(isObject)
    .map((b) => ({
      upTo: typeof b.upTo === 'number' && Number.isFinite(b.upTo) ? b.upTo : null,
      rate: typeof b.rate === 'number' && Number.isFinite(b.rate) ? b.rate : 0,
    }));
  if (plan.tax.brackets.length === 0) plan.tax.brackets = base.tax.brackets;
  plan.expenses.oneOffs = (Array.isArray(plan.expenses.oneOffs) ? plan.expenses.oneOffs : []).filter(isObject).map((o, i) => ({
    id: typeof o.id === 'string' ? o.id : `item-${i}`,
    label: typeof o.label === 'string' ? o.label.slice(0, 60) : 'Expense',
    year: typeof o.year === 'number' ? o.year : year,
    amount: typeof o.amount === 'number' ? o.amount : 0,
    everyYears: typeof o.everyYears === 'number' ? o.everyYears : 0,
    untilYear: typeof o.untilYear === 'number' ? o.untilYear : 0,
    inflate: o.inflate !== false,
  }));
  plan.breakdowns = {};
  const rawBreakdowns = isObject(input) && isObject(input.breakdowns) ? input.breakdowns : {};
  for (const [key, lines] of Object.entries(rawBreakdowns).slice(0, 100)) {
    if (!/^[a-zA-Z0-9.]{1,60}$/.test(key) || !Array.isArray(lines)) continue;
    const clean = lines
      .filter(isObject)
      .slice(0, 50)
      .map((l, i) => ({
        id: typeof l.id === 'string' ? l.id.slice(0, 40) : `line-${i}`,
        label: typeof l.label === 'string' ? l.label.slice(0, 60) : '',
        amount: typeof l.amount === 'number' && Number.isFinite(l.amount) ? l.amount : 0,
      }));
    if (clean.length > 0) plan.breakdowns[key] = clean;
  }
  const p = plan.profile;
  p.currentAge = Math.min(94, Math.max(18, Math.round(p.currentAge)));
  p.endAge = Math.min(110, Math.max(p.currentAge + 1, Math.round(p.endAge)));
  p.retireAge = Math.min(p.endAge, Math.max(18, Math.round(p.retireAge)));
  plan.monteCarlo.runs = Math.min(5000, Math.max(1000, Math.round(plan.monteCarlo.runs)));
  if (plan.drawStrategy !== 'proRata') plan.drawStrategy = 'sequential';
  if (plan.statutory.lockIn !== 'ERS') plan.statutory.lockIn = 'FRS';
  if (plan.expenses.retirementMode !== 'custom') plan.expenses.retirementMode = 'multiplier';
  if (!['low', 'base', 'high'].includes(plan.income.bonusScenario)) plan.income.bonusScenario = 'base';
  return plan;
}
