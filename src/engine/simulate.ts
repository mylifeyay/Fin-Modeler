import { progressiveTax } from './tax';
import type { Plan, Projection, Sampler, YearDraw, YearRow } from './types';

const pct = (x: number): number => (Number.isFinite(x) ? x / 100 : 0);
const num = (x: number): number => (Number.isFinite(x) ? x : 0);
const pos = (x: number): number => (Number.isFinite(x) && x > 0 ? x : 0);

/** Number of simulated years: current age up to (not including) the end age. */
export function horizonYears(plan: Plan): number {
  return Math.max(1, Math.round(plan.profile.endAge - plan.profile.currentAge));
}

/** Calendar year in which the tenancy lock-in ends. 0 when unset. */
export function tenancyEndYear(plan: Plan): number {
  const y = parseInt(plan.property.tenancyEnd.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}

/** Year the property is actually sold: never before the lock-in ends or before today. */
export function effectiveSaleYear(plan: Plan, startYear: number): number | null {
  if (!plan.property.enabled || !plan.property.sell) return null;
  return Math.max(Math.round(num(plan.property.sellYear)), tenancyEndYear(plan), startYear);
}

/** Monthly gross salary. Take-home input is grossed up for the employee contribution. */
export function grossMonthlySalary(plan: Plan): number {
  const { income, statutory: st } = plan;
  const s = pos(income.salaryMonthly);
  if (income.salaryIsGross || !st.enabled) return s;
  const ee = pct(st.employeeRate);
  if (ee <= 0 || ee >= 1) return s;
  const uncapped = s / (1 - ee);
  return uncapped <= st.wageCeilingMonthly ? uncapped : s + st.wageCeilingMonthly * ee;
}

export function bonusMonths(plan: Plan): number {
  const i = plan.income;
  return pos(i.bonusScenario === 'low' ? i.bonusLowMonths : i.bonusScenario === 'high' ? i.bonusHighMonths : i.bonusBaseMonths);
}

/** Expected-value draw used by the deterministic projection. */
export function expectedDraw(plan: Plan): YearDraw {
  const l = plan.liquid;
  return {
    rCash: pct(l.cash.ret),
    rDom: pct(l.domEq.ret),
    rFor: pct(l.forEq.ret),
    rBond: pct(l.bonds.ret),
    rAlt: pct(l.alt.ret),
    rDeferred: pct(plan.tax.deferredReturn),
    rProp: pct(plan.property.appreciation),
    fx: pct(l.forEq.fxDrift),
    inflation: pct(plan.macro.inflation),
    bonusMonths: bonusMonths(plan),
  };
}

export interface MortgageYear {
  payment: number;
  interest: number;
  balance: number;
  monthsLeft: number;
}

/** Twelve monthly instalments of a level-payment mortgage. */
export function amortizeYear(balance: number, annualRatePct: number, monthsLeft: number): MortgageYear {
  if (!(balance > 0.005)) return { payment: 0, interest: 0, balance: 0, monthsLeft: 0 };
  const n = Math.max(12, Math.round(monthsLeft));
  const r = pct(annualRatePct) / 12;
  const instalment = r > 0 ? (balance * r) / (1 - Math.pow(1 + r, -n)) : balance / n;
  let bal = balance;
  let payment = 0;
  let interest = 0;
  for (let m = 0; m < 12 && bal > 0.005; m++) {
    const i = bal * r;
    const principal = Math.min(bal, instalment - i);
    bal -= principal;
    interest += i;
    payment += principal + i;
  }
  return { payment, interest, balance: bal < 0.005 ? 0 : bal, monthsLeft: Math.max(0, n - 12) };
}

/** Level monthly instalment for the current mortgage. */
export function monthlyInstalment(plan: Plan): number {
  const p = plan.property;
  if (!(p.mortgageBalance > 0)) return 0;
  const n = Math.max(12, Math.round(p.mortgageYearsLeft * 12));
  const r = pct(p.mortgageRate) / 12;
  return r > 0 ? (p.mortgageBalance * r) / (1 - Math.pow(1 + r, -n)) : p.mortgageBalance / n;
}

export interface SaleSplit {
  grossValue: number;
  sellingCosts: number;
  mortgage: number;
  netProceeds: number;
  refundDue: number;
  refund: number;
  freeCash: number;
}

/**
 * Split sale proceeds. The statutory refund (principal + accrued interest)
 * ranks ahead of the owner and is capped at net proceeds.
 */
export function splitSale(
  value: number,
  sellingCostPct: number,
  mortgage: number,
  housingPrincipal: number,
  housingAccrued: number,
  statutoryEnabled: boolean,
): SaleSplit {
  const sellingCosts = value * pct(sellingCostPct);
  const netProceeds = value - sellingCosts - mortgage;
  const refundDue = statutoryEnabled ? housingPrincipal + housingAccrued : 0;
  const refund = Math.min(refundDue, Math.max(0, netProceeds));
  return { grossValue: value, sellingCosts, mortgage, netProceeds, refundDue, refund, freeCash: netProceeds - refund };
}

export interface PathOut {
  /** Length n + 1. Index i is the start of year i. The last entry is the close. */
  accessible: Float64Array;
  headline: Float64Array;
  infl: Float64Array;
  /** Length n. Unfunded spending per year. */
  shortfall: Float64Array;
}

export function allocPathOut(n: number): PathOut {
  return {
    accessible: new Float64Array(n + 1),
    headline: new Float64Array(n + 1),
    infl: new Float64Array(n + 1),
    shortfall: new Float64Array(n),
  };
}

/**
 * Simulate one path, one year per step.
 *
 * Order within a year: age-triggered events, opening snapshot, market growth and
 * statutory interest on opening balances, income, property flows, tax, spending,
 * optional property sale, then the net cash flow is saved or drawn at year end.
 */
export function runPath(plan: Plan, startYear: number, sampler: Sampler, out: PathOut, rows?: YearRow[]): void {
  const { profile, liquid, statutory: st, property: pr, income, tax, expenses: ex } = plan;
  const n = horizonYears(plan);
  const stOn = st.enabled;
  const currentAge = Math.round(num(profile.currentAge));
  const retireAge = Math.round(num(profile.retireAge));
  const retStartAge = Math.max(retireAge, currentAge);

  // --- liquid state ---
  let cash = pos(liquid.cash.balance);
  let dom = pos(liquid.domEq.balance);
  let forF = pos(liquid.forEq.balance);
  let fx = liquid.forEq.fxRate > 0 ? liquid.forEq.fxRate : 1;
  let bond = pos(liquid.bonds.balance);
  let alt = pos(liquid.alt.balance);
  const keep = 1 - Math.min(0.99, Math.max(0, pct(liquid.alt.haircut)));
  const yCash = pct(liquid.cash.yieldPct);
  const yDom = pct(liquid.domEq.yieldPct);
  const yFor = pct(liquid.forEq.yieldPct);
  const yBond = pct(liquid.bonds.yieldPct);
  const yAlt = pct(liquid.alt.yieldPct);
  const sCash = pos(liquid.cash.savePct);
  const sDom = pos(liquid.domEq.savePct);
  const sFor = pos(liquid.forEq.savePct);
  const sBond = pos(liquid.bonds.savePct);
  const sAlt = pos(liquid.alt.savePct);
  const sTotal = sCash + sDom + sFor + sBond + sAlt;

  // --- tax-deferred state ---
  let deferred = pos(tax.deferredBalance);
  const defAge = tax.deferredWithdrawAge;
  const defYears = Math.max(1, Math.round(tax.deferredWithdrawYears));

  // --- statutory state ---
  let oa = stOn ? pos(st.oa) : 0;
  let sa = stOn ? pos(st.sa) : 0;
  let ma = stOn ? pos(st.ma) : 0;
  let ra = stOn ? pos(st.ra) : 0;
  let annuity = 0;
  let payoutAnnual = 0;
  let unlocked = stOn && currentAge > st.unlockAge;
  let payoutStarted = false;
  if (stOn && currentAge > st.payoutAge) {
    payoutStarted = true;
    annuity = ra;
    ra = 0;
    payoutAnnual = annuity * pct(st.payoutRate);
  }
  const oaRate = pct(st.oaRate);
  const saRate = pct(st.saRate);
  const maRate = pct(st.maRate);
  const eeRate = pct(st.employeeRate);
  const erRate = pct(st.employerRate);
  const shareSum = pos(st.oaShare) + pos(st.saShare) + pos(st.maShare);
  const oaSh = shareSum > 0 ? pos(st.oaShare) / shareSum : 1;
  const saSh = shareSum > 0 ? pos(st.saShare) / shareSum : 0;
  const maSh = shareSum > 0 ? pos(st.maShare) / shareSum : 0;
  const lockMult = st.lockIn === 'ERS' ? Math.max(1, num(st.ersMultiple)) : 1;
  let frs = pos(st.frs);
  let maCap = pos(st.maCap);
  let lockTarget = frs * lockMult;

  // --- property state ---
  let held = pr.enabled;
  let propValue = held ? pos(pr.marketValue) : 0;
  let mort = held ? pos(pr.mortgageBalance) : 0;
  let mortMonths = Math.round(pos(pr.mortgageYearsLeft) * 12);
  let housingPrincipal = held && stOn ? pos(pr.cpfPrincipalUsed) : 0;
  let housingAccrued = held && stOn ? pos(pr.cpfAccruedInterest) : 0;
  let rentMonthly = pos(pr.monthlyRent);
  const lockYear = tenancyEndYear(plan);
  const saleYear = effectiveSaleYear(plan, startYear);

  // --- income / spending state ---
  let grossMonthly = grossMonthlySalary(plan);
  let secondaryAnnual = pos(income.secondaryAnnual);
  let inflIdx = 1;
  const reliefs = pos(tax.reliefs);
  const extraInfl = pct(ex.retirementExtraInflation);
  const retMult = pct(ex.retirementMultiplier);

  /** Route money into the retirement-sum account, spilling the excess to OA. */
  const toRetirement = (amount: number): void => {
    if (amount <= 0) return;
    if (!unlocked) {
      const a = Math.min(amount, Math.max(0, frs - sa));
      sa += a;
      oa += amount - a;
    } else if (!payoutStarted) {
      const a = Math.min(amount, Math.max(0, lockTarget - ra));
      ra += a;
      oa += amount - a;
    } else {
      oa += amount;
    }
  };

  for (let t = 0; t < n; t++) {
    const age = currentAge + t;
    const year = startYear + t;
    const working = age < retireAge;
    const d = sampler(t);

    // 1. Age-triggered events.
    if (stOn && !unlocked && age >= st.unlockAge) {
      lockTarget = frs * lockMult;
      let room = Math.max(0, lockTarget - ra);
      const fromSa = Math.min(sa, room);
      sa -= fromSa;
      ra += fromSa;
      room -= fromSa;
      const fromOa = Math.min(oa, room);
      oa -= fromOa;
      ra += fromOa;
      oa += sa; // the special account closes; the excess becomes withdrawable
      sa = 0;
      unlocked = true;
    }
    if (stOn && !payoutStarted && age >= st.payoutAge) {
      annuity = ra;
      ra = 0;
      payoutAnnual = annuity * pct(st.payoutRate);
      payoutStarted = true;
    }

    // Opening snapshot.
    const liquidOpen = cash + dom + forF * fx + bond + alt * keep;
    const accessibleOpen = liquidOpen + (unlocked ? oa : 0) + (age >= defAge ? deferred : 0);
    const headlineOpen = liquidOpen + deferred + oa + sa + ma + ra + annuity + (held ? propValue - mort : 0);
    out.accessible[t] = accessibleOpen;
    out.headline[t] = headlineOpen;
    out.infl[t] = inflIdx;
    const inflOpen = inflIdx;

    // 2. Market growth and yield on opening balances.
    fx = Math.max(1e-6, fx * (1 + d.fx));
    const dividends = cash * yCash + dom * yDom + forF * fx * yFor + bond * yBond + alt * keep * yAlt;
    cash *= Math.max(0, 1 + d.rCash - yCash);
    dom *= Math.max(0, 1 + d.rDom - yDom);
    forF *= Math.max(0, 1 + d.rFor - yFor);
    bond *= Math.max(0, 1 + d.rBond - yBond);
    alt *= Math.max(0, 1 + d.rAlt - yAlt);
    deferred *= Math.max(0, 1 + d.rDeferred);
    if (stOn) {
      oa *= 1 + oaRate;
      sa *= 1 + saRate;
      ma *= 1 + maRate;
      ra *= 1 + saRate;
      annuity *= 1 + saRate;
    }
    if (held) {
      propValue *= Math.max(0, 1 + d.rProp);
      housingAccrued += (housingPrincipal + housingAccrued) * pct(pr.accruedRate);
    }

    // 3. Employment income and statutory contributions.
    const salary = working ? grossMonthly * 12 : 0;
    const bonus = working ? d.bonusMonths * grossMonthly : 0;
    let employee = 0;
    let employer = 0;
    let maOverflow = 0;
    if (stOn && working) {
      const ordinary = Math.min(grossMonthly, st.wageCeilingMonthly * inflIdx) * 12;
      const additional = Math.min(bonus, Math.max(0, st.wageCeilingAnnual * inflIdx - ordinary));
      employee = (ordinary + additional) * eeRate;
      employer = (ordinary + additional) * erRate;
      const total = employee + employer;
      oa += total * oaSh;
      ma += total * maSh;
      if (unlocked) toRetirement(total * saSh);
      else sa += total * saSh;
    }
    if (stOn && ma > maCap) {
      maOverflow = ma - maCap;
      ma = maCap;
      toRetirement(maOverflow);
    }

    // 4. Property: rent, running costs, mortgage.
    let rentNet = 0;
    let mortInterest = 0;
    let mortCash = 0;
    let mortOa = 0;
    if (held) {
      const vacancy = year <= lockYear ? 0 : pct(pr.vacancyPct);
      const grossRent = rentMonthly * 12 * (1 - vacancy);
      const opex = (pos(pr.propertyTaxAnnual) + pos(pr.maintenanceMonthly) * 12) * inflIdx + grossRent * pct(pr.agentFeePct);
      rentNet = grossRent - opex;
      if (mort > 0) {
        const m = amortizeYear(mort, pr.mortgageRate, mortMonths);
        mort = m.balance;
        mortMonths = m.monthsLeft;
        mortInterest = m.interest;
        mortOa = stOn ? Math.min(oa, m.payment * pct(pr.oaSharePct)) : 0;
        oa -= mortOa;
        housingPrincipal += mortOa;
        mortCash = m.payment - mortOa;
      }
    }

    // 5. Other income.
    const secondary = income.secondaryEndYear === 0 || year <= income.secondaryEndYear ? secondaryAnnual : 0;
    const payout = payoutStarted ? payoutAnnual : 0;
    if (payoutStarted) annuity = Math.max(0, annuity - payout);

    const defContribution = working ? Math.min(pos(tax.deferredContribution), pos(tax.deferredCap)) : 0;
    deferred += defContribution;
    let defWithdrawal = 0;
    if (age >= defAge && deferred > 0) {
      defWithdrawal = deferred / Math.max(1, defAge + defYears - age);
      deferred -= defWithdrawal;
    }

    // 6. Tax. Mortgage interest is deductible against rent, never below zero.
    const taxableRent = Math.max(0, rentNet - mortInterest);
    const chargeable = Math.max(
      0,
      salary + bonus - employee - defContribution - reliefs + taxableRent + secondary + defWithdrawal * pct(tax.deferredTaxablePct),
    );
    const taxDue = progressiveTax(chargeable, tax.brackets);

    // 7. Spending.
    const baseLiving = (pos(ex.baseMonthly) + pos(ex.discretionaryMonthly)) * 12 * inflIdx;
    let living = baseLiving;
    if (!working) {
      const drift = Math.pow(1 + extraInfl, age - retStartAge);
      living = (ex.retirementMode === 'multiplier' ? baseLiving * retMult : pos(ex.retirementCustomMonthly) * 12 * inflIdx) * drift;
    }
    let oneOff = 0;
    for (const o of ex.oneOffs) {
      if (!(o.amount > 0) || year < o.year) continue;
      const hit =
        o.everyYears > 0
          ? (year - o.year) % Math.round(o.everyYears) === 0 && (o.untilYear === 0 || year <= o.untilYear)
          : year === o.year;
      if (hit) oneOff += o.amount * (o.inflate ? inflIdx : 1);
    }

    // 8. Property sale at year end.
    let saleFreeCash = 0;
    let saleRefund = 0;
    if (held && saleYear !== null && year >= saleYear) {
      const s = splitSale(propValue, pr.sellingCostPct, mort, housingPrincipal, housingAccrued, stOn);
      saleFreeCash = s.freeCash;
      saleRefund = s.refund;
      if (unlocked) toRetirement(saleRefund);
      else oa += saleRefund;
      held = false;
      propValue = 0;
      mort = 0;
      housingPrincipal = 0;
      housingAccrued = 0;
    }

    // 9. Net cash flow: save the surplus or draw the deficit.
    const inflow = salary + bonus - employee + rentNet + dividends + secondary + payout + defWithdrawal + saleFreeCash;
    const outflow = taxDue + defContribution + living + oneOff + mortCash;
    const net = inflow - outflow;
    let saved = 0;
    let drawn = 0;
    let shortfall = 0;
    if (net >= 0) {
      saved = net;
      if (sTotal > 0) {
        cash += (net * sCash) / sTotal;
        dom += (net * sDom) / sTotal;
        forF += (net * sFor) / sTotal / fx;
        bond += (net * sBond) / sTotal;
        alt += (net * sAlt) / sTotal;
      } else {
        cash += net;
      }
    } else {
      let need = -net;
      const forBase = forF * fx;
      const altCounted = alt * keep;
      if (plan.drawStrategy === 'proRata') {
        const pool = cash + dom + forBase + bond + altCounted;
        const f = pool > 0 ? Math.min(1, need / pool) : 0;
        need -= pool * f;
        cash -= cash * f;
        dom -= dom * f;
        forF -= forF * f;
        bond -= bond * f;
        alt -= alt * f;
      } else {
        let take = Math.min(cash, need);
        cash -= take;
        need -= take;
        take = Math.min(bond, need);
        bond -= take;
        need -= take;
        take = Math.min(dom, need);
        dom -= take;
        need -= take;
        take = Math.min(forBase, need);
        forF -= take / fx;
        need -= take;
        take = Math.min(altCounted, need);
        alt -= take / keep;
        need -= take;
      }
      if (need > 0 && unlocked) {
        const take = Math.min(oa, need);
        oa -= take;
        need -= take;
      }
      if (need > 0 && age >= defAge) {
        const take = Math.min(deferred, need);
        deferred -= take;
        need -= take;
      }
      if (need < 0.005) need = 0;
      shortfall = need;
      drawn = -net - need;
    }
    out.shortfall[t] = shortfall;

    // 10. Roll the indices forward.
    inflIdx *= 1 + Math.max(-0.5, d.inflation);
    grossMonthly *= 1 + pct(income.salaryGrowth);
    if (year >= lockYear) rentMonthly *= 1 + pct(pr.rentGrowth);
    secondaryAnnual *= Math.max(0, 1 - pct(income.secondaryDecay));
    if (!unlocked) frs *= 1 + pct(st.frsGrowth);
    if (age + 1 <= st.payoutAge) maCap *= 1 + pct(st.maCapGrowth);

    if (rows) {
      const forEq = forF * fx;
      const liquidClose = cash + dom + forEq + bond + alt * keep;
      rows.push({
        t,
        year,
        age,
        phase: working ? 'work' : stOn && age < st.unlockAge ? 'bridge' : 'retired',
        inflOpen,
        inflClose: inflIdx,
        salary,
        bonus,
        rentNet,
        dividends,
        secondary,
        statutoryPayout: payout,
        deferredWithdrawal: defWithdrawal,
        employeeContribution: employee,
        employerContribution: employer,
        maOverflow,
        tax: taxDue,
        chargeableIncome: chargeable,
        deferredContribution: defContribution,
        living,
        oneOff,
        mortgageCash: mortCash,
        mortgageOa: mortOa,
        mortgageInterest: mortInterest,
        saleFreeCash,
        saleRefund,
        netCashFlow: net,
        saved,
        drawn,
        shortfall,
        cash,
        domEq: dom,
        forEq,
        bonds: bond,
        alt: alt * keep,
        altRaw: alt,
        liquid: liquidClose,
        deferred,
        oa,
        sa,
        ma,
        ra,
        annuity,
        statutoryTotal: oa + sa + ma + ra + annuity,
        statutoryUnlocked: unlocked,
        propValue,
        mortgage: mort,
        propEquity: held ? propValue - mort : 0,
        housingPrincipal,
        housingAccrued,
        fxRate: fx,
        accessibleOpen,
        headlineOpen,
        accessible: liquidClose + (unlocked ? oa : 0) + (age >= defAge ? deferred : 0),
        headline: liquidClose + deferred + oa + sa + ma + ra + annuity + (held ? propValue - mort : 0),
      });
    }
  }

  // Closing snapshot at the end age.
  const endAge = currentAge + n;
  const liquidEnd = cash + dom + forF * fx + bond + alt * keep;
  out.accessible[n] = liquidEnd + (unlocked ? oa : 0) + (endAge >= defAge ? deferred : 0);
  out.headline[n] = liquidEnd + deferred + oa + sa + ma + ra + annuity + (held ? propValue - mort : 0);
  out.infl[n] = inflIdx;
}

/** Deterministic projection on expected values. */
export function project(plan: Plan, startYear: number): Projection {
  const n = horizonYears(plan);
  const out = allocPathOut(n);
  const rows: YearRow[] = [];
  const draw = expectedDraw(plan);
  runPath(plan, startYear, () => draw, out, rows);
  const currentAge = Math.round(plan.profile.currentAge);
  let totalShortfall = 0;
  let firstShortfallAge: number | null = null;
  for (const r of rows) {
    totalShortfall += r.shortfall;
    if (r.shortfall > 0 && firstShortfallAge === null) firstShortfallAge = r.age;
  }
  return {
    startYear,
    rows,
    ages: Array.from({ length: n + 1 }, (_, i) => currentAge + i),
    accessible: Array.from(out.accessible),
    headline: Array.from(out.headline),
    inflIndex: Array.from(out.infl),
    totalShortfall,
    firstShortfallAge,
  };
}
