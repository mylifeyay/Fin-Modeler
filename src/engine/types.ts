/**
 * Plan schema. Every rate is stored in percent units (6 = 6% p.a.) because that
 * is what a person types. The engine converts to fractions at the boundary.
 * Every money figure is in the plan's base currency unless stated otherwise.
 */

export type BonusScenario = 'low' | 'base' | 'high';
export type DrawStrategy = 'sequential' | 'proRata';
export type RetirementSumLock = 'FRS' | 'ERS';

export interface AssetBucket {
  balance: number;
  /** Expected total return, % p.a. */
  ret: number;
  /** Annual volatility, % */
  vol: number;
  /** Cash yield (dividend / coupon), % p.a. Part of `ret`, paid out as income. */
  yieldPct: number;
  /** Share of each year's surplus routed to this bucket, % */
  savePct: number;
}

export interface ForeignBucket extends AssetBucket {
  /** `balance` is held in this currency. */
  currency: string;
  /** Base-currency units per 1 foreign unit. */
  fxRate: number;
  /** Expected FX drift of the foreign currency vs base, % p.a. */
  fxDrift: number;
  fxVol: number;
}

export interface AltBucket extends AssetBucket {
  /** Valuation haircut, %. Net worth counts balance x (1 - haircut). */
  haircut: number;
}

export interface LiquidAssets {
  cash: AssetBucket;
  domEq: AssetBucket;
  forEq: ForeignBucket;
  bonds: AssetBucket;
  alt: AltBucket;
}

export type LiquidKey = keyof LiquidAssets;

export interface StatutoryAccounts {
  enabled: boolean;
  oa: number;
  sa: number;
  ma: number;
  /** Retirement Account balance. Only relevant once past the unlock age. */
  ra: number;
  oaRate: number;
  saRate: number;
  maRate: number;
  /** Healthcare ceiling. Contributions and interest above it overflow. */
  maCap: number;
  maCapGrowth: number;
  /** Age at which the retirement sum is locked in and the rest of OA unlocks. */
  unlockAge: number;
  /** Full Retirement Sum in today's terms. */
  frs: number;
  frsGrowth: number;
  /** Enhanced sum as a multiple of FRS. */
  ersMultiple: number;
  lockIn: RetirementSumLock;
  /** Age at which the lifetime payout starts. */
  payoutAge: number;
  /** Annual payout as % of the Retirement Account balance at payout start. */
  payoutRate: number;
  employeeRate: number;
  employerRate: number;
  /** Split of total contributions. Normalised by the engine. */
  oaShare: number;
  saShare: number;
  maShare: number;
  /** Monthly ordinary-wage ceiling for contributions. */
  wageCeilingMonthly: number;
  /** Annual total-wage ceiling (ordinary + additional wages). */
  wageCeilingAnnual: number;
}

export interface PropertyModule {
  enabled: boolean;
  purchaseCost: number;
  marketValue: number;
  appreciation: number;
  vol: number;
  mortgageBalance: number;
  mortgageRate: number;
  mortgageYearsLeft: number;
  /** Share of each mortgage instalment paid from the Ordinary Account, %. */
  oaSharePct: number;
  monthlyRent: number;
  rentGrowth: number;
  propertyTaxAnnual: number;
  maintenanceMonthly: number;
  /** Vacancy buffer, % of gross rent. Applied only after the tenancy lock-in. */
  vacancyPct: number;
  /** Agent / management fee, % of gross rent. */
  agentFeePct: number;
  /** Tenancy lock-in end, `YYYY-MM`. The property cannot be sold before it. */
  tenancyEnd: string;
  /** Statutory funds already used for the property (principal). */
  cpfPrincipalUsed: number;
  /** Interest already accrued on that principal. */
  cpfAccruedInterest: number;
  accruedRate: number;
  sellingCostPct: number;
  sell: boolean;
  /** Calendar year of the planned sale. */
  sellYear: number;
}

export interface OneOffExpense {
  id: string;
  label: string;
  /** First calendar year it occurs. */
  year: number;
  amount: number;
  /** 0 = once. Otherwise repeats every N years. */
  everyYears: number;
  /** Last calendar year for a repeating item. 0 = no end. */
  untilYear: number;
  /** Amount is in today's dollars and grows with inflation. */
  inflate: boolean;
}

export interface IncomeModel {
  salaryMonthly: number;
  /** true: before employee statutory contribution. false: take-home after it. Both pre-tax. */
  salaryIsGross: boolean;
  salaryGrowth: number;
  /** Bonus expressed in months of gross salary. */
  bonusLowMonths: number;
  bonusBaseMonths: number;
  bonusHighMonths: number;
  bonusScenario: BonusScenario;
  secondaryAnnual: number;
  secondaryDecay: number;
  /** Last calendar year of secondary income. 0 = never ends. */
  secondaryEndYear: number;
}

export interface TaxBracket {
  /** Upper bound of chargeable income for this band. null = no upper bound. */
  upTo: number | null;
  rate: number;
}

export interface TaxModel {
  brackets: TaxBracket[];
  /** Flat annual reliefs deducted from assessable income. */
  reliefs: number;
  /** Annual cap for tax-deferred (SRS-style) contributions. */
  deferredCap: number;
  deferredContribution: number;
  deferredBalance: number;
  deferredReturn: number;
  deferredVol: number;
  deferredWithdrawAge: number;
  deferredWithdrawYears: number;
  /** Share of each withdrawal that is taxable, %. */
  deferredTaxablePct: number;
}

export interface ExpenseModel {
  baseMonthly: number;
  discretionaryMonthly: number;
  oneOffs: OneOffExpense[];
  retirementMode: 'multiplier' | 'custom';
  /** Retirement spend as % of pre-retirement living spend. */
  retirementMultiplier: number;
  /** Custom retirement budget, per month, in today's dollars. */
  retirementCustomMonthly: number;
  /** Extra inflation on retirement spending (travel, healthcare), pp above CPI. */
  retirementExtraInflation: number;
}

export interface TallyLine {
  id: string;
  label: string;
  /** Signed. A negative line subtracts from the total. */
  amount: number;
}

export interface Plan {
  schema: 1;
  label: string;
  baseCurrency: string;
  profile: { currentAge: number; retireAge: number; endAge: number };
  macro: { inflation: number; inflationVol: number; equityCorrelation: number };
  liquid: LiquidAssets;
  drawStrategy: DrawStrategy;
  statutory: StatutoryAccounts;
  property: PropertyModule;
  income: IncomeModel;
  tax: TaxModel;
  expenses: ExpenseModel;
  monteCarlo: { runs: number; seed: number };
  /**
   * Optional itemised make-up of a single input, keyed by field id (for
   * example the separate bank accounts behind the cash balance). Bookkeeping
   * for the person only: the engine reads the summed field, never these lines.
   */
  breakdowns: Record<string, TallyLine[]>;
}

/** One simulated year. Flows are for the year. Balances are end of year. */
export interface YearRow {
  t: number;
  year: number;
  age: number;
  phase: 'work' | 'bridge' | 'retired';
  /** Price index at the start and end of the year (today = 1). */
  inflOpen: number;
  inflClose: number;

  salary: number;
  bonus: number;
  rentNet: number;
  dividends: number;
  secondary: number;
  statutoryPayout: number;
  deferredWithdrawal: number;

  employeeContribution: number;
  employerContribution: number;
  maOverflow: number;
  tax: number;
  chargeableIncome: number;
  deferredContribution: number;

  living: number;
  oneOff: number;
  mortgageCash: number;
  mortgageOa: number;
  mortgageInterest: number;

  saleFreeCash: number;
  saleRefund: number;

  /** Cash in minus cash out. Positive is saved, negative is drawn. */
  netCashFlow: number;
  saved: number;
  drawn: number;
  /** Spending that no accessible asset could fund. */
  shortfall: number;

  cash: number;
  domEq: number;
  forEq: number;
  bonds: number;
  alt: number;
  altRaw: number;
  liquid: number;
  deferred: number;
  oa: number;
  sa: number;
  ma: number;
  ra: number;
  annuity: number;
  statutoryTotal: number;
  statutoryUnlocked: boolean;
  propValue: number;
  mortgage: number;
  propEquity: number;
  housingPrincipal: number;
  housingAccrued: number;
  fxRate: number;

  /** Start of year, after any age-triggered event (unlock, payout start). */
  accessibleOpen: number;
  headlineOpen: number;
  accessible: number;
  headline: number;
}

export interface Projection {
  startYear: number;
  rows: YearRow[];
  /** One point per age from currentAge to endAge inclusive (rows.length + 1). */
  ages: number[];
  accessible: number[];
  headline: number[];
  /** Price index aligned with `ages`. */
  inflIndex: number[];
  totalShortfall: number;
  firstShortfallAge: number | null;
}

/** Random draws for one simulated year. All fractions. */
export interface YearDraw {
  rCash: number;
  rDom: number;
  rFor: number;
  rBond: number;
  rAlt: number;
  rDeferred: number;
  rProp: number;
  fx: number;
  inflation: number;
  bonusMonths: number;
}

export type Sampler = (t: number) => YearDraw;

export interface PercentileBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface MonteCarloResult {
  runs: number;
  ages: number[];
  accessible: { nominal: PercentileBands; real: PercentileBands };
  headline: { nominal: PercentileBands; real: PercentileBands };
  /** Share of paths with no unfunded spending through the end age. */
  successRate: number;
  /** Share of paths with no unfunded spending between retirement and unlock. null = no bridge. */
  bridgeSurvival: number | null;
  /** Count of paths first running dry at each age (aligned with `ages`). */
  depletionByAge: number[];
  /** Ending accessible net worth, in today's dollars. */
  endingReal: HistogramBin[];
  endingRealMedian: number;
  endingRealP10: number;
  endingRealP90: number;
  elapsedMs: number;
}
