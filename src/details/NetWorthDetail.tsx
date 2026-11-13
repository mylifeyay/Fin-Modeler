import { useMemo, useState } from 'react';
import { SegBar } from '../components/charts/SegBar';
import { Group, Money, Note, Row, Slider } from '../components/ui';
import { project } from '../engine/simulate';
import type { Plan } from '../engine/types';
import { BUCKET_COLOR, BUCKET_LABEL } from '../lib/colors';
import { full } from '../lib/format';
import { useAdjust, useApp } from '../store/context';

function shifted(plan: Plan, returnShift: number, inflationShift: number): Plan {
  const p = structuredClone(plan);
  for (const key of ['cash', 'domEq', 'forEq', 'bonds', 'alt'] as const) p.liquid[key].ret += returnShift;
  p.tax.deferredReturn += returnShift;
  p.macro.inflation = Math.max(0, p.macro.inflation + inflationShift);
  return p;
}

export function NetWorthDetail() {
  const { plan, projection, startYear } = useApp();
  const adj = useAdjust();
  const [returnShift, setReturnShift] = useState(0);
  const [inflationShift, setInflationShift] = useState(0);
  const { liquid: l, statutory: st, property: pr, tax, profile } = plan;

  const keep = 1 - l.alt.haircut / 100;
  const forBase = l.forEq.balance * l.forEq.fxRate;
  const altCounted = l.alt.balance * keep;
  const liquid = l.cash.balance + l.domEq.balance + forBase + l.bonds.balance + altCounted;
  const statutory = st.enabled ? st.oa + st.sa + st.ma + st.ra : 0;
  const unlocked = st.enabled && profile.currentAge > st.unlockAge;
  const equity = pr.enabled ? pr.marketValue - pr.mortgageBalance : 0;
  const deferredOpen = profile.currentAge >= tax.deferredWithdrawAge;
  const headline = liquid + tax.deferredBalance + statutory + equity;
  const accessible = liquid + (unlocked ? st.oa : 0) + (deferredOpen ? tax.deferredBalance : 0);

  const whatIf = useMemo(
    () => (returnShift === 0 && inflationShift === 0 ? projection : project(shifted(plan, returnShift, inflationShift), startYear)),
    [plan, projection, startYear, returnShift, inflationShift],
  );

  const milestoneAges = [...new Set([profile.retireAge, st.enabled ? st.unlockAge : -1, st.enabled ? st.payoutAge : -1, 80, profile.endAge])]
    .filter((a) => a > profile.currentAge && a <= profile.endAge)
    .sort((a, b) => a - b);
  const at = (p: typeof projection, age: number, series: 'accessible' | 'headline') => {
    const i = age - profile.currentAge;
    return adj(p[series][i], p.inflIndex[i]);
  };
  const dirty = returnShift !== 0 || inflationShift !== 0;

  return (
    <div>
      <Group title="Composition today">
        <div className="py-2">
          <SegBar
            ariaLabel="Headline net worth by bucket"
            segments={[
              { label: BUCKET_LABEL.cash, value: l.cash.balance, color: BUCKET_COLOR.cash },
              { label: BUCKET_LABEL.domEq, value: l.domEq.balance, color: BUCKET_COLOR.domEq },
              { label: BUCKET_LABEL.forEq, value: forBase, color: BUCKET_COLOR.forEq },
              { label: BUCKET_LABEL.bonds, value: l.bonds.balance, color: BUCKET_COLOR.bonds },
              { label: 'Alternatives (after haircut)', value: altCounted, color: BUCKET_COLOR.alt },
              { label: 'Tax-deferred account', value: tax.deferredBalance, color: BUCKET_COLOR.deferred },
              ...(st.enabled ? [{ label: 'Statutory accounts', value: statutory, color: BUCKET_COLOR.statutory }] : []),
              ...(pr.enabled ? [{ label: 'Property equity', value: Math.max(0, equity), color: BUCKET_COLOR.property }] : []),
            ]}
          />
        </div>
      </Group>

      <Group title="Headline to accessible" note="Accessible net worth is what can fund spending today without selling the property or touching locked accounts.">
        <Row label={BUCKET_LABEL.cash}>
          <Money v={l.cash.balance} />
        </Row>
        <Row label={BUCKET_LABEL.domEq}>
          <Money v={l.domEq.balance} />
        </Row>
        <Row
          label={BUCKET_LABEL.forEq}
          hint={
            <>
              <span className="money num">{full(l.forEq.balance)}</span> {l.forEq.currency} × {l.forEq.fxRate}
            </>
          }
        >
          <Money v={forBase} />
        </Row>
        <Row label={BUCKET_LABEL.bonds}>
          <Money v={l.bonds.balance} />
        </Row>
        <Row
          label={BUCKET_LABEL.alt}
          hint={
            <>
              <span className="money num">{full(l.alt.balance)}</span> less {l.alt.haircut}% haircut
            </>
          }
        >
          <Money v={altCounted} />
        </Row>
        <Row label="Liquid assets" strong>
          <Money v={liquid} />
        </Row>
        <Row label="Tax-deferred account" hint={deferredOpen ? 'Withdrawable' : `Locked until age ${tax.deferredWithdrawAge}`}>
          <Money v={tax.deferredBalance} />
        </Row>
        {st.enabled && (
          <>
            <Row label="Ordinary account" indent>
              <Money v={st.oa} />
            </Row>
            <Row label="Special account" indent>
              <Money v={st.sa} />
            </Row>
            <Row label="Healthcare account" indent>
              <Money v={st.ma} />
            </Row>
            {st.ra > 0 && (
              <Row label="Retirement account" indent>
                <Money v={st.ra} />
              </Row>
            )}
          </>
        )}
        {pr.enabled && (
          <Row
            label="Property equity"
            hint={
              <>
                <span className="money num">{full(pr.marketValue)}</span> value less <span className="money num">{full(pr.mortgageBalance)}</span> mortgage
              </>
            }
          >
            <Money v={equity} />
          </Row>
        )}
        <Row label="Headline net worth" strong>
          <Money v={headline} />
        </Row>
        {st.enabled && (
          <Row label="Less locked statutory balances">
            <Money v={-(statutory - (unlocked ? st.oa : 0))} />
          </Row>
        )}
        {!deferredOpen && tax.deferredBalance > 0 && (
          <Row label="Less tax-deferred account">
            <Money v={-tax.deferredBalance} />
          </Row>
        )}
        {pr.enabled && (
          <Row label="Less property equity">
            <Money v={-equity} />
          </Row>
        )}
        <Row label="Accessible net worth" strong>
          <Money v={accessible} />
        </Row>
      </Group>

      <Group title="Sensitivity" note="A what-if on this panel only. The plan itself is unchanged.">
        <Slider label="All liquid returns" value={returnShift} min={-3} max={3} step={0.25} onChange={setReturnShift} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)} pp`} />
        <Slider label="Inflation" value={inflationShift} min={-2} max={3} step={0.25} onChange={setInflationShift} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)} pp`} />
        <div className="mt-1 grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1.5 border-t border-line pt-2.5 pb-1 text-[13px]">
          <span className="text-fg3">Age</span>
          <span className="text-right text-fg3">Accessible</span>
          <span className="text-right text-fg3">Headline</span>
          {milestoneAges.map((age) => (
            <div key={age} className="contents">
              <span className="num text-fg2">{age}</span>
              <span className="text-right text-fg">
                <Money v={at(whatIf, age, 'accessible')} compact />
                {dirty && <Money v={at(whatIf, age, 'accessible') - at(projection, age, 'accessible')} compact sign className="ml-1.5 text-[11.5px] text-fg3" />}
              </span>
              <span className="text-right text-fg">
                <Money v={at(whatIf, age, 'headline')} compact />
              </span>
            </div>
          ))}
        </div>
      </Group>
      {whatIf.firstShortfallAge !== null && (
        <div className="mt-3">
          <Note tone="critical">On these assumptions accessible assets run out at age {whatIf.firstShortfallAge}.</Note>
        </div>
      )}
    </div>
  );
}
