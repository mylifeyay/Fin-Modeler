import { useMemo, useState } from 'react';
import { TimeChart } from '../components/charts/TimeChart';
import { Button, Group, Money, Note, Pill, Row, Slider, type Tone } from '../components/ui';
import { analyzeBridge, type BridgeAnalysis, type BridgeStatus } from '../engine/analysis';
import { project } from '../engine/simulate';
import { C } from '../lib/colors';
import { percent, ratio } from '../lib/format';
import { useAdjust, useApp } from '../store/context';

const TONE: Record<BridgeStatus, Tone> = { none: 'neutral', funded: 'good', tight: 'warning', fails: 'critical' };

function verdict(b: BridgeAnalysis): string {
  switch (b.status) {
    case 'none':
      return 'No bridge to fund. Work continues to the unlock age, or the statutory module is off.';
    case 'funded':
      return `Accessible assets carry all ${b.years} bridge years with no forced sale of locked assets.`;
    case 'tight':
      return `The bridge holds, but the low point leaves under two years of spending in reserve.`;
    case 'fails':
      return `Accessible assets run out at age ${b.firstShortfallAge}, before the unlock. A forced sale of illiquid assets would be needed.`;
  }
}

export function BridgeDetail() {
  const { plan, projection, bridge, mc, update, startYear } = useApp();
  const adj = useAdjust();
  const { profile, statutory: st, expenses: ex } = plan;
  const [retireAge, setRetireAge] = useState<number | null>(null);
  const [spendShift, setSpendShift] = useState(0);
  const [returnShift, setReturnShift] = useState(0);
  const dirty = retireAge !== null || spendShift !== 0 || returnShift !== 0;

  const scenario = useMemo(() => {
    if (!dirty) return { projection, bridge };
    const p = structuredClone(plan);
    if (retireAge !== null) p.profile.retireAge = retireAge;
    p.expenses.retirementMultiplier *= 1 + spendShift / 100;
    p.expenses.retirementCustomMonthly *= 1 + spendShift / 100;
    for (const key of ['cash', 'domEq', 'forEq', 'bonds', 'alt'] as const) p.liquid[key].ret += returnShift;
    const proj = project(p, startYear);
    return { projection: proj, bridge: analyzeBridge(p, proj) };
  }, [dirty, plan, projection, bridge, retireAge, spendShift, returnShift, startYear]);

  const b = scenario.bridge;
  const base = bridge;
  const from = Math.max(profile.currentAge, Math.min(b.fromAge, base.fromAge) - 2);
  const to = Math.min(profile.endAge, st.unlockAge + 3);
  const slice = (p: typeof projection) => {
    const i0 = from - profile.currentAge;
    const i1 = to - profile.currentAge;
    return p.accessible.slice(i0, i1 + 1).map((v, k) => adj(v, p.inflIndex[i0 + k]));
  };
  const xs = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  const apply = () => {
    update((d) => {
      if (retireAge !== null) d.profile.retireAge = retireAge;
      d.expenses.retirementMultiplier = Math.round(d.expenses.retirementMultiplier * (1 + spendShift / 100));
      d.expenses.retirementCustomMonthly = Math.round(d.expenses.retirementCustomMonthly * (1 + spendShift / 100));
    });
    setRetireAge(null);
    setSpendShift(0);
  };

  if (!st.enabled) return <Note>The statutory accounts module is off, so there is no unlock age and no bridge. Turn it on under Plan.</Note>;

  return (
    <div>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <Pill tone={TONE[b.status]}>{b.status === 'none' ? 'No bridge' : b.status === 'funded' ? 'Funded' : b.status === 'tight' ? 'Tight' : 'Fails'}</Pill>
          <span className="num text-[13px] text-fg2">
            Age {b.fromAge} → {b.toAge}
          </span>
        </div>
        <p className="mt-2.5 text-[14px] leading-snug text-fg">{verdict(b)}</p>
        {mc.result && mc.result.bridgeSurvival !== null && !dirty && (
          <p className="mt-1.5 text-[13px] text-fg2">
            Monte Carlo: <span className="num font-semibold text-fg">{percent(mc.result.bridgeSurvival, 1)}</span> of {mc.result.runs.toLocaleString('en-US')} paths survive the bridge.
          </p>
        )}
      </div>

      {xs.length > 1 && (
        <div className="card mt-3 px-3 pt-3 pb-3">
          <TimeChart
            xs={xs}
            height={180}
            ariaLabel="Accessible net worth across the bridge years"
            lines={[
              ...(dirty ? [{ id: 'base', label: 'Plan', color: 'var(--fg3)', values: slice(projection), dashed: true }] : []),
              { id: 'acc', label: dirty ? 'What-if' : 'Accessible net worth', color: C.accessible, values: slice(scenario.projection), area: true },
            ]}
            markers={[
              { x: b.fromAge, label: `Retire ${b.fromAge}` },
              { x: st.unlockAge, label: `Unlock ${st.unlockAge}` },
            ]}
            zone={b.status !== 'none' ? { from: b.fromAge, to: b.toAge, label: 'Bridge years' } : undefined}
          />
        </div>
      )}

      <Group title="Sensitivity" note="Drag to stress the bridge. Nothing is saved until you apply it.">
        <Slider label="Retire at" value={retireAge ?? profile.retireAge} min={Math.min(profile.currentAge, 40)} max={Math.max(st.unlockAge + 5, profile.retireAge)} onChange={setRetireAge} format={(v) => `Age ${v}`} />
        <Slider label="Retirement spending" value={spendShift} min={-30} max={50} step={5} onChange={setSpendShift} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`} />
        <Slider label="All liquid returns" value={returnShift} min={-4} max={2} step={0.25} onChange={setReturnShift} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)} pp`} />
        {dirty && (
          <div className="flex gap-2 pt-1 pb-2">
            <Button
              className="flex-1"
              onClick={() => {
                setRetireAge(null);
                setSpendShift(0);
                setReturnShift(0);
              }}
            >
              Reset
            </Button>
            <Button className="flex-1" variant="primary" onClick={apply} disabled={retireAge === null && spendShift === 0}>
              Apply to plan
            </Button>
          </div>
        )}
      </Group>

      {b.status !== 'none' && (
        <>
          <Group title="Bridge reconciliation" note={`Spending uses the ${ex.retirementMode === 'multiplier' ? `${ex.retirementMultiplier}% retirement multiplier` : 'custom retirement budget'}. Figures are totals across the bridge.`}>
            <Row label="Accessible net worth at retirement">
              <Money v={adj(b.accessibleAtStart, b.rows[0].inflOpen)} />
            </Row>
            <Row label="Spending, mortgage and tax" hint={`${b.years} years`}>
              <Money v={-b.rows.reduce((s, r) => s + adj(r.living + r.oneOff + r.mortgageCash + r.tax, r.inflOpen), 0)} />
            </Row>
            <Row label="Passive income" hint="Rent, dividends, secondary income">
              <Money v={b.rows.reduce((s, r) => s + adj(r.rentNet + r.dividends + r.secondary + r.deferredWithdrawal, r.inflOpen), 0)} />
            </Row>
            <Row label="Drawn from accessible assets" strong>
              <Money v={-b.rows.reduce((s, r) => s + adj(Math.max(0, -r.netCashFlow), r.inflOpen), 0)} />
            </Row>
            <Row label="Coverage" hint="Accessible at retirement ÷ total draw, before investment growth">
              {ratio(b.coverage)}
            </Row>
            <Row label="Low point" hint={`Age ${b.minAccessibleAge} · ${Number.isFinite(b.runwayAtLow) ? `${b.runwayAtLow.toFixed(1)} years of spending` : 'no spending'}`}>
              <Money v={adj(b.minAccessible, b.rows[Math.min(b.rows.length - 1, Math.max(0, b.minAccessibleAge - b.fromAge))].inflOpen)} />
            </Row>
            <Row label={`Released at age ${b.toAge}`} hint="Statutory balance above the locked retirement sum">
              <Money v={adj(b.unlockedAtEnd, b.rows[b.rows.length - 1].inflClose)} />
            </Row>
            {b.shortfall > 0 && (
              <Row label="Unfunded spending">
                <Money v={-b.shortfall} />
              </Row>
            )}
          </Group>

          <Group title="Year by year">
            <div className="scroll-x -mx-1">
              <table className="num w-full min-w-[360px] border-collapse text-right text-[12.5px]">
                <thead>
                  <tr className="text-fg3">
                    <th className="py-1.5 pl-1 text-left font-medium">Age</th>
                    <th className="px-2 font-medium">Open</th>
                    <th className="px-2 font-medium">Income</th>
                    <th className="px-2 font-medium">Outgo</th>
                    <th className="px-2 font-medium">Net</th>
                    <th className="pr-1 pl-2 font-medium">Close</th>
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r) => (
                    <tr key={r.age} className="border-t border-line text-fg">
                      <td className="py-1.5 pl-1 text-left text-fg2">{r.age}</td>
                      <td className="px-2">
                        <Money v={adj(r.accessibleOpen, r.inflOpen)} compact />
                      </td>
                      <td className="px-2">
                        <Money v={adj(r.rentNet + r.dividends + r.secondary + r.deferredWithdrawal + r.saleFreeCash, r.inflOpen)} compact />
                      </td>
                      <td className="px-2">
                        <Money v={adj(r.living + r.oneOff + r.mortgageCash + r.tax, r.inflOpen)} compact />
                      </td>
                      <td className="px-2">
                        <Money v={adj(r.netCashFlow, r.inflOpen)} compact sign />
                      </td>
                      <td className="pr-1 pl-2">
                        <Money v={adj(r.accessible, r.inflClose)} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Group>
        </>
      )}
    </div>
  );
}
