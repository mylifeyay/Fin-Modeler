import { describe, expect, it } from 'vitest';
import { analyzeBridge, compareHoldSell, saleSchedule } from './analysis';
import { projectionToCsv } from './csv';
import { blankPlan, normalizePlan, samplePlan } from './defaults';
import { runMonteCarlo } from './montecarlo';
import { amortizeYear, grossMonthlySalary, project, splitSale } from './simulate';
import { marginalRate, progressiveTax, taxBreakdown } from './tax';
import type { Plan } from './types';

const YEAR = 2030;
const sample = (): Plan => samplePlan(YEAR);

describe('progressive tax', () => {
  const brackets = [
    { upTo: 20_000, rate: 0 },
    { upTo: 40_000, rate: 5 },
    { upTo: null, rate: 10 },
  ];
  it('taxes each band at its own rate', () => {
    expect(progressiveTax(0, brackets)).toBe(0);
    expect(progressiveTax(20_000, brackets)).toBe(0);
    expect(progressiveTax(30_000, brackets)).toBeCloseTo(500);
    expect(progressiveTax(100_000, brackets)).toBeCloseTo(1_000 + 6_000);
  });
  it('reconciles the band breakdown to the total', () => {
    const total = taxBreakdown(100_000, brackets).reduce((s, l) => s + l.tax, 0);
    expect(total).toBeCloseTo(progressiveTax(100_000, brackets));
    expect(marginalRate(30_000, brackets)).toBe(5);
  });
});

describe('property sale split', () => {
  it('refunds principal plus accrued interest before the owner sees cash', () => {
    const s = splitSale(1_000_000, 2, 400_000, 150_000, 50_000, true);
    expect(s.netProceeds).toBeCloseTo(580_000);
    expect(s.refund).toBeCloseTo(200_000);
    expect(s.freeCash).toBeCloseTo(380_000);
  });
  it('caps the refund at net proceeds', () => {
    const s = splitSale(500_000, 0, 450_000, 150_000, 50_000, true);
    expect(s.refund).toBeCloseTo(50_000);
    expect(s.freeCash).toBeCloseTo(0);
  });
  it('leaves the owner with the loss when the sale is under water', () => {
    const s = splitSale(400_000, 0, 450_000, 150_000, 50_000, true);
    expect(s.refund).toBe(0);
    expect(s.freeCash).toBeCloseTo(-50_000);
  });
});

describe('mortgage', () => {
  it('fully amortises over the remaining term', () => {
    let balance = 600_000;
    let months = 240;
    for (let y = 0; y < 20; y++) {
      const m = amortizeYear(balance, 3, months);
      balance = m.balance;
      months = m.monthsLeft;
    }
    expect(balance).toBeLessThan(1);
  });
});

describe('deterministic projection', () => {
  it('runs from the current age to the end age', () => {
    const p = project(sample(), YEAR);
    expect(p.rows).toHaveLength(60);
    expect(p.ages[0]).toBe(35);
    expect(p.ages[p.ages.length - 1]).toBe(95);
    expect(p.accessible).toHaveLength(61);
  });

  it('opens on today’s balance sheet', () => {
    const plan = sample();
    const p = project(plan, YEAR);
    const liquid = 100_000 + 150_000 + 150_000 * 1.3 + 80_000 + 30_000 * 0.7;
    expect(p.accessible[0]).toBeCloseTo(liquid);
    expect(p.headline[0]).toBeCloseTo(liquid + 40_000 + 260_000 + (1_400_000 - 600_000));
  });

  it('keeps every balance finite and non-negative', () => {
    for (const r of project(sample(), YEAR).rows) {
      for (const v of [r.cash, r.domEq, r.forEq, r.bonds, r.alt, r.oa, r.sa, r.ma, r.ra, r.deferred, r.mortgage]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('caps the healthcare account and overflows the excess', () => {
    const rows = project(sample(), YEAR).rows;
    const capped = rows.find((r) => r.maOverflow > 0);
    expect(capped).toBeDefined();
    let cap = 80_000;
    for (const r of rows.slice(0, 10)) {
      expect(r.ma).toBeLessThanOrEqual(cap + 1e-6);
      cap *= 1.04;
    }
  });

  it('routes healthcare overflow to the special account while it is below the retirement sum', () => {
    const plan = blankPlan(YEAR);
    plan.profile = { currentAge: 30, retireAge: 60, endAge: 95 };
    plan.income.salaryMonthly = 5_000;
    plan.statutory.ma = 80_000;
    plan.statutory.maCapGrowth = 0;
    const r = project(plan, YEAR).rows[0];
    const contribution = 5_000 * 12 * 0.37;
    expect(r.maOverflow).toBeCloseTo(80_000 * 0.04 + contribution * 0.22);
    expect(r.ma).toBeCloseTo(80_000);
    expect(r.sa).toBeCloseTo(contribution * 0.16 + r.maOverflow);
    expect(r.oa).toBeCloseTo(contribution * 0.62);
  });

  it('locks the retirement sum and releases the rest at the unlock age', () => {
    const p = project(sample(), YEAR);
    const before = p.rows.find((r) => r.age === 54)!;
    const at = p.rows.find((r) => r.age === 55)!;
    expect(before.statutoryUnlocked).toBe(false);
    expect(at.statutoryUnlocked).toBe(true);
    expect(at.sa).toBe(0);
    expect(at.accessibleOpen).toBeGreaterThan(before.accessible);
    expect(at.headlineOpen).toBeCloseTo(before.headline, 4);
    const frsAt55 = 220_000 * Math.pow(1.035, 20);
    expect(at.ra).toBeCloseTo(frsAt55 * 1.04, 0);
  });

  it('starts the lifetime payout at the payout age', () => {
    const rows = project(sample(), YEAR).rows;
    expect(rows.find((r) => r.age === 64)!.statutoryPayout).toBe(0);
    const first = rows.find((r) => r.age === 65)!;
    expect(first.statutoryPayout).toBeGreaterThan(0);
    expect(rows.find((r) => r.age === 94)!.statutoryPayout).toBeCloseTo(first.statutoryPayout);
  });

  it('stops salary at retirement and marks the bridge years', () => {
    const rows = project(sample(), YEAR).rows;
    expect(rows.find((r) => r.age === 47)!.salary).toBeGreaterThan(0);
    expect(rows.find((r) => r.age === 48)!.salary).toBe(0);
    expect(rows.filter((r) => r.phase === 'bridge').map((r) => r.age)).toEqual([48, 49, 50, 51, 52, 53, 54]);
  });

  it('reduces tax by the tax-deferred contribution', () => {
    const withTopUp = project(sample(), YEAR).rows[0];
    const plan = sample();
    plan.tax.deferredContribution = 0;
    const without = project(plan, YEAR).rows[0];
    expect(without.tax - withTopUp.tax).toBeGreaterThan(15_300 * 0.1);
    expect(withTopUp.deferredContribution).toBe(15_300);
  });

  it('grosses up a take-home salary for the employee contribution', () => {
    const plan = sample();
    plan.income.salaryIsGross = false;
    plan.income.salaryMonthly = 4_000;
    expect(grossMonthlySalary(plan)).toBeCloseTo(5_000);
    plan.income.salaryMonthly = 10_400;
    expect(grossMonthlySalary(plan)).toBeCloseTo(12_000);
  });

  it('reports a shortfall instead of a negative balance when money runs out', () => {
    const plan = blankPlan(YEAR);
    plan.statutory.enabled = false;
    plan.profile = { currentAge: 60, retireAge: 60, endAge: 70 };
    plan.liquid.cash.balance = 100_000;
    plan.liquid.cash.ret = 0;
    plan.macro.inflation = 0;
    plan.expenses.baseMonthly = 5_000;
    plan.expenses.retirementMultiplier = 100;
    plan.expenses.retirementExtraInflation = 0;
    const p = project(plan, YEAR);
    expect(p.rows[0].accessible).toBeCloseTo(40_000);
    expect(p.rows[1].accessible).toBeCloseTo(0);
    expect(p.rows[1].shortfall).toBeCloseTo(20_000);
    expect(p.firstShortfallAge).toBe(61);
  });
});

describe('property scenarios', () => {
  it('splits a sale into the statutory refund and free cash', () => {
    const plan = sample();
    plan.property.sell = true;
    plan.property.sellYear = YEAR + 2;
    const p = project(plan, YEAR);
    const saleRow = p.rows.find((r) => r.year === YEAR + 2)!;
    expect(saleRow.saleRefund).toBeGreaterThan(170_000);
    expect(saleRow.saleFreeCash).toBeGreaterThan(0);
    expect(saleRow.propValue).toBe(0);
    expect(saleRow.propEquity).toBe(0);
    const schedule = saleSchedule(plan, YEAR).find((r) => r.year === YEAR + 2)!;
    expect(schedule.refund).toBeCloseTo(saleRow.saleRefund);
    expect(schedule.freeCash).toBeCloseTo(saleRow.saleFreeCash);
    expect(schedule.refund + schedule.freeCash).toBeCloseTo(schedule.netProceeds);
  });

  it('never sells before the tenancy lock-in ends', () => {
    const plan = sample();
    plan.property.sell = true;
    plan.property.sellYear = YEAR;
    const rows = project(plan, YEAR).rows;
    expect(rows.find((r) => r.year === YEAR)!.propValue).toBeGreaterThan(0);
    expect(rows.find((r) => r.year === YEAR + 2)!.propValue).toBe(0);
  });

  it('grows the accrued-interest claim every year the property is held', () => {
    const s = saleSchedule(sample(), YEAR);
    expect(s[10].housingAccrued).toBeGreaterThan(s[0].housingAccrued);
    expect(s[10].housingPrincipal).toBeGreaterThan(s[0].housingPrincipal);
  });

  it('compares hold and sell on the same assumptions', () => {
    const c = compareHoldSell(sample(), YEAR)!;
    expect(c.saleYear).toBe(YEAR + 2);
    expect(c.hold.rows).toHaveLength(c.sell.rows.length);
    const m = c.milestones.find((x) => x.age === 55)!;
    expect(m.sellAccessible).toBeGreaterThan(m.holdAccessible);
  });
});

describe('bridge analysis', () => {
  it('covers the years between retirement and unlock', () => {
    const plan = sample();
    const b = analyzeBridge(plan, project(plan, YEAR));
    expect(b.fromAge).toBe(48);
    expect(b.toAge).toBe(55);
    expect(b.years).toBe(7);
    expect(b.status).not.toBe('none');
    expect(b.unlockedAtEnd).toBeGreaterThan(0);
  });
  it('reports no bridge when retirement is at or after unlock', () => {
    const plan = sample();
    plan.profile.retireAge = 60;
    expect(analyzeBridge(plan, project(plan, YEAR)).status).toBe('none');
  });
  it('fails when accessible assets cannot fund the gap', () => {
    const plan = sample();
    plan.profile.retireAge = 36;
    plan.expenses.retirementMultiplier = 300;
    plan.property.monthlyRent = 0;
    expect(analyzeBridge(plan, project(plan, YEAR)).status).toBe('fails');
  });
});

describe('monte carlo', () => {
  it('is reproducible for a given seed and orders its percentiles', () => {
    const a = runMonteCarlo(sample(), YEAR, 300, 7);
    const b = runMonteCarlo(sample(), YEAR, 300, 7);
    expect(a.successRate).toBe(b.successRate);
    expect(a.accessible.real.p50).toEqual(b.accessible.real.p50);
    expect(a.successRate).toBeGreaterThanOrEqual(0);
    expect(a.successRate).toBeLessThanOrEqual(1);
    expect(a.bridgeSurvival).not.toBeNull();
    expect(a.bridgeSurvival!).toBeGreaterThanOrEqual(a.successRate);
    for (let i = 0; i < a.ages.length; i++) {
      const band = a.headline.nominal;
      expect(band.p10[i]).toBeLessThanOrEqual(band.p25[i] + 1e-6);
      expect(band.p25[i]).toBeLessThanOrEqual(band.p50[i] + 1e-6);
      expect(band.p50[i]).toBeLessThanOrEqual(band.p75[i] + 1e-6);
      expect(band.p75[i]).toBeLessThanOrEqual(band.p90[i] + 1e-6);
    }
    expect(a.endingReal.reduce((s, x) => s + x.count, 0)).toBe(300);
  });
  it('collapses onto the deterministic path when every volatility is zero', () => {
    const plan = sample();
    plan.liquid.cash.vol = 0;
    plan.liquid.domEq.vol = 0;
    plan.liquid.forEq.vol = 0;
    plan.liquid.forEq.fxVol = 0;
    plan.liquid.bonds.vol = 0;
    plan.liquid.alt.vol = 0;
    plan.tax.deferredVol = 0;
    plan.property.vol = 0;
    plan.macro.inflationVol = 0;
    plan.income.bonusLowMonths = plan.income.bonusHighMonths = plan.income.bonusBaseMonths;
    const det = project(plan, YEAR);
    const mc = runMonteCarlo(plan, YEAR, 50, 1);
    expect(mc.headline.nominal.p50[30]).toBeCloseTo(det.headline[30], 2);
    expect(mc.accessible.nominal.p10[60]).toBeCloseTo(det.accessible[60], 2);
  });
});

describe('plan hygiene', () => {
  it('normalises hostile input onto the schema', () => {
    const p = normalizePlan({ profile: { currentAge: 'x', retireAge: 40 }, liquid: { cash: { balance: 5 } }, extra: 1, tax: { brackets: 'no' } }, YEAR);
    expect(p.profile.currentAge).toBe(35);
    expect(p.profile.retireAge).toBe(40);
    expect(p.liquid.cash.balance).toBe(5);
    expect(p.tax.brackets.length).toBeGreaterThan(0);
    expect('extra' in p).toBe(false);
  });
  it('round-trips the sample preset', () => {
    expect(normalizePlan(JSON.parse(JSON.stringify(sample())), YEAR)).toEqual(sample());
  });
  it('projects a blank plan without errors', () => {
    const p = project(blankPlan(YEAR), YEAR);
    expect(p.headline.every((v) => v === 0)).toBe(true);
    expect(p.totalShortfall).toBe(0);
  });
  it('exports one CSV line per year plus a header', () => {
    const csv = projectionToCsv(project(sample(), YEAR), true);
    expect(csv.trim().split('\r\n')).toHaveLength(61);
  });
});
