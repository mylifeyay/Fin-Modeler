import { useState } from 'react';
import { Bars } from '../components/charts/Bars';
import { Group, Money, Note, Row, Slider } from '../components/ui';
import { C } from '../lib/colors';
import { percent } from '../lib/format';
import { marginalRate, progressiveTax, taxBreakdown } from '../engine/tax';
import { useAdjust, useApp } from '../store/context';

function useYearPicker() {
  const { projection, plan } = useApp();
  const [t, setT] = useState(0);
  const i = Math.min(t, projection.rows.length - 1);
  return { row: projection.rows[i], t: i, setT, max: projection.rows.length - 1, currentAge: plan.profile.currentAge };
}

function YearSlider({ t, setT, max, year, age }: { t: number; setT: (v: number) => void; max: number; year: number; age: number }) {
  return <Slider label="Year" value={t} min={0} max={max} onChange={setT} format={() => `${year} · age ${age}`} />;
}

export function CashflowDetail() {
  const { projection, plan } = useApp();
  const adj = useAdjust();
  const { row: r, t, setT, max } = useYearPicker();
  const a = (v: number) => adj(v, r.inflOpen);
  const inflow = r.salary + r.bonus + r.rentNet + r.dividends + r.secondary + r.statutoryPayout + r.deferredWithdrawal + r.saleFreeCash;

  return (
    <div>
      <div className="card px-3 pt-3 pb-2">
        <Bars
          ariaLabel="Net cash flow by year"
          color={C.accessible}
          negativeColor={C.orange}
          unit="money"
          height={140}
          bars={projection.rows.map((x) => ({ key: String(x.year), value: adj(x.netCashFlow, x.inflOpen), title: `${x.year} · age ${x.age}` }))}
          axis={[projection.rows[0].age, projection.rows[Math.floor(max / 2)].age, projection.rows[max].age]}
        />
        <div className="mt-1 px-1 text-[12px] text-fg3">Net cash flow by age. Above the line is saved. Below it is drawn from assets.</div>
      </div>

      <Group title="Reconciliation">
        <YearSlider t={t} setT={setT} max={max} year={r.year} age={r.age} />
        <Row label="Salary">
          <Money v={a(r.salary)} />
        </Row>
        <Row label="Bonus" hint={r.bonus > 0 ? `${plan.income.bonusScenario} band` : undefined}>
          <Money v={a(r.bonus)} />
        </Row>
        <Row label="Net rental income" hint="Rent less tax, upkeep, vacancy and agent fees">
          <Money v={a(r.rentNet)} />
        </Row>
        <Row label="Dividends and coupons">
          <Money v={a(r.dividends)} />
        </Row>
        <Row label="Secondary income">
          <Money v={a(r.secondary)} />
        </Row>
        {r.statutoryPayout > 0 && (
          <Row label="Statutory lifetime payout">
            <Money v={a(r.statutoryPayout)} />
          </Row>
        )}
        {r.deferredWithdrawal > 0 && (
          <Row label="Tax-deferred withdrawal">
            <Money v={a(r.deferredWithdrawal)} />
          </Row>
        )}
        {r.saleFreeCash !== 0 && (
          <Row label="Property sale: free cash">
            <Money v={a(r.saleFreeCash)} />
          </Row>
        )}
        <Row label="Total inflow" strong>
          <Money v={a(inflow)} />
        </Row>
        <Row label="Employee statutory contribution">
          <Money v={-a(r.employeeContribution)} />
        </Row>
        <Row label="Income tax">
          <Money v={-a(r.tax)} />
        </Row>
        <Row label="Tax-deferred top-up">
          <Money v={-a(r.deferredContribution)} />
        </Row>
        <Row label="Living expenses" hint={r.phase === 'work' ? 'Base plus discretionary' : 'Retirement budget'}>
          <Money v={-a(r.living)} />
        </Row>
        <Row label="One-off and periodic expenses">
          <Money v={-a(r.oneOff)} />
        </Row>
        <Row label="Mortgage paid in cash" hint={r.mortgageOa > 0 ? 'Excludes the part paid from the ordinary account' : undefined}>
          <Money v={-a(r.mortgageCash)} />
        </Row>
        <Row label="Net cash flow" strong>
          <Money v={a(r.netCashFlow)} sign />
        </Row>
        <Row label={r.netCashFlow >= 0 ? 'Invested per savings allocation' : 'Drawn from accessible assets'}>
          <Money v={a(r.netCashFlow >= 0 ? r.saved : r.drawn)} />
        </Row>
        {inflow > 0 && r.netCashFlow > 0 && <Row label="Savings rate">{percent(r.netCashFlow / inflow)}</Row>}
      </Group>
      {r.shortfall > 0 && (
        <div className="mt-3">
          <Note tone="critical">
            <Money v={a(r.shortfall)} /> of spending is unfunded this year. Accessible assets are exhausted.
          </Note>
        </div>
      )}
    </div>
  );
}

export function TaxDetail() {
  const { plan, update } = useApp();
  const adj = useAdjust();
  const { row: r, t, setT, max } = useYearPicker();
  const a = (v: number) => adj(v, r.inflOpen);
  const { tax } = plan;
  const lines = taxBreakdown(r.chargeableIncome, tax.brackets).filter((l) => l.taxable > 0);
  const gross = r.salary + r.bonus + Math.max(0, r.rentNet) + r.secondary + r.deferredWithdrawal;
  const taxableRent = Math.max(0, r.rentNet - r.mortgageInterest);
  const withoutTopUp = progressiveTax(r.chargeableIncome + r.deferredContribution, tax.brackets);

  return (
    <div>
      <Group title="Chargeable income">
        <YearSlider t={t} setT={setT} max={max} year={r.year} age={r.age} />
        <Row label="Employment income" hint="Salary plus bonus">
          <Money v={a(r.salary + r.bonus)} />
        </Row>
        <Row label="Employee statutory contribution">
          <Money v={-a(r.employeeContribution)} />
        </Row>
        <Row label="Tax-deferred top-up">
          <Money v={-a(r.deferredContribution)} />
        </Row>
        <Row label="Reliefs">
          <Money v={-tax.reliefs} />
        </Row>
        <Row label="Taxable rent" hint="Net rent less mortgage interest">
          <Money v={a(taxableRent)} />
        </Row>
        <Row label="Secondary income">
          <Money v={a(r.secondary)} />
        </Row>
        {r.deferredWithdrawal > 0 && (
          <Row label="Tax-deferred withdrawal" hint={`${tax.deferredTaxablePct}% taxable`}>
            <Money v={a((r.deferredWithdrawal * tax.deferredTaxablePct) / 100)} />
          </Row>
        )}
        <Row label="Chargeable income" strong>
          <Money v={a(r.chargeableIncome)} />
        </Row>
      </Group>

      <Group title="Tax by band" note="Bands are applied in nominal dollars for the selected year.">
        {lines.length === 0 && <div className="py-2 text-[13px] text-fg3">No income falls in a taxed band.</div>}
        {lines.map((l) => (
          <Row
            key={l.from}
            label={
              <span className="num">
                {l.rate}% <span className="text-fg3">on</span> <Money v={l.taxable} compact />
              </span>
            }
            hint={
              <span className="num">
                Band <Money v={l.from} compact /> to {l.to === null ? 'no limit' : <Money v={l.to} compact />}
              </span>
            }
          >
            <Money v={l.tax} />
          </Row>
        ))}
        <Row label="Income tax" strong>
          <Money v={r.tax} />
        </Row>
        <Row label="Effective rate on gross income">{gross > 0 ? percent(r.tax / gross, 1) : '—'}</Row>
        <Row label="Marginal rate">{marginalRate(r.chargeableIncome, tax.brackets)}%</Row>
      </Group>

      <Group title="Tax-deferred top-up" note={`Contributions reduce chargeable income now, compound untaxed, and are ${tax.deferredTaxablePct}% taxable when drawn over ${tax.deferredWithdrawYears} years from age ${tax.deferredWithdrawAge}.`}>
        <Slider
          label="Annual contribution"
          value={Math.min(tax.deferredContribution, tax.deferredCap)}
          min={0}
          max={tax.deferredCap}
          step={Math.max(1, Math.round(tax.deferredCap / 51))}
          onChange={(v) => update((d) => void (d.tax.deferredContribution = Math.min(v, d.tax.deferredCap)))}
          format={(v) => <Money v={v} />}
        />
        <Row label="Tax saved in the selected year">
          <Money v={withoutTopUp - r.tax} />
        </Row>
        <Row label="Balance at end of year">
          <Money v={adj(r.deferred, r.inflClose)} />
        </Row>
      </Group>
    </div>
  );
}
