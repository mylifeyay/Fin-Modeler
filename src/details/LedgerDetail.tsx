import { useState } from 'react';
import { Money, Segmented } from '../components/ui';
import type { YearRow } from '../engine/types';
import { useAdjust, useApp } from '../store/context';

type GroupId = 'flow' | 'worth' | 'locked' | 'property';
interface Col {
  label: string;
  get: (r: YearRow) => number;
  /** Deflate with the end-of-year index (balances) rather than the start (flows). */
  close?: boolean;
  sign?: boolean;
}

const COLS: Record<GroupId, Col[]> = {
  flow: [
    { label: 'Income', get: (r) => r.salary + r.bonus + r.rentNet + r.dividends + r.secondary + r.statutoryPayout + r.deferredWithdrawal - r.employeeContribution },
    { label: 'Tax', get: (r) => r.tax },
    { label: 'Spending', get: (r) => r.living + r.oneOff + r.mortgageCash + r.deferredContribution },
    { label: 'Net flow', get: (r) => r.netCashFlow, sign: true },
    { label: 'Shortfall', get: (r) => r.shortfall },
  ],
  worth: [
    { label: 'Liquid', get: (r) => r.liquid, close: true },
    { label: 'Deferred', get: (r) => r.deferred, close: true },
    { label: 'Statutory', get: (r) => r.statutoryTotal, close: true },
    { label: 'Property', get: (r) => r.propEquity, close: true },
    { label: 'Accessible', get: (r) => r.accessible, close: true },
    { label: 'Headline', get: (r) => r.headline, close: true },
  ],
  locked: [
    { label: 'Contrib.', get: (r) => r.employeeContribution + r.employerContribution },
    { label: 'Ordinary', get: (r) => r.oa, close: true },
    { label: 'Special/RA', get: (r) => r.sa + r.ra + r.annuity, close: true },
    { label: 'Health', get: (r) => r.ma, close: true },
    { label: 'Payout', get: (r) => r.statutoryPayout },
  ],
  property: [
    { label: 'Value', get: (r) => r.propValue, close: true },
    { label: 'Mortgage', get: (r) => r.mortgage, close: true },
    { label: 'Net rent', get: (r) => r.rentNet },
    { label: 'OA used', get: (r) => r.housingPrincipal, close: true },
    { label: 'Accrued', get: (r) => r.housingAccrued, close: true },
    { label: 'Free cash', get: (r) => r.saleFreeCash },
  ],
};

const PHASE_MARK: Record<YearRow['phase'], string> = { work: 'W', bridge: 'B', retired: 'R' };

/** Annual cash-flow and net-worth bridge. Sticky header and first column, horizontal scroll for the rest. */
export function LedgerTable({ maxHeight }: { maxHeight?: string }) {
  const { projection, plan, settings } = useApp();
  const adj = useAdjust();
  const [group, setGroup] = useState<GroupId>('flow');
  const options: { value: GroupId; label: string }[] = [
    { value: 'flow', label: 'Cash flow' },
    { value: 'worth', label: 'Net worth' },
    ...(plan.statutory.enabled ? [{ value: 'locked' as const, label: 'Statutory' }] : []),
    ...(plan.property.enabled ? [{ value: 'property' as const, label: 'Property' }] : []),
  ];
  const active = options.some((o) => o.value === group) ? group : 'flow';
  const cols = COLS[active];

  return (
    <div>
      <Segmented label="Ledger columns" options={options} value={active} onChange={setGroup} />
      <div className="card mt-3 overflow-hidden">
        <div className="scroll-x overflow-y-auto" style={{ maxHeight: maxHeight ?? 'none' }}>
          <table className="num w-full border-separate border-spacing-0 text-right text-[12.5px]">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-solid py-2.5 pr-2 pl-3 text-left font-medium text-fg3">Year</th>
                {cols.map((c) => (
                  <th key={c.label} className="sticky top-0 z-10 bg-solid px-2.5 py-2.5 font-medium whitespace-nowrap text-fg3 last:pr-3">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projection.rows.map((r) => (
                <tr key={r.year}>
                  <td className="sticky left-0 z-10 border-t border-line bg-solid py-2 pr-2 pl-3 text-left whitespace-nowrap">
                    <span className="text-fg">{r.year}</span>
                    <span className="ml-1.5 text-fg3">{r.age}</span>
                    <span className="ml-1.5 inline-block w-3 text-[10px] font-semibold text-fg3" title={r.phase}>
                      {PHASE_MARK[r.phase]}
                    </span>
                  </td>
                  {cols.map((c) => {
                    const v = adj(c.get(r), c.close ? r.inflClose : r.inflOpen);
                    return (
                      <td key={c.label} className={`border-t border-line px-2.5 py-2 whitespace-nowrap last:pr-3 ${Math.abs(v) < 0.5 ? 'text-fg3' : 'text-fg'}`}>
                        {Math.abs(v) < 0.5 ? '–' : <Money v={v} compact sign={c.sign} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-2 px-1 text-[12px] leading-snug text-fg3">
        W working, B bridge, R retired. Flows are for the year, balances are year end. {settings.real ? 'Today’s dollars.' : 'Nominal dollars.'}
      </div>
    </div>
  );
}

export function LedgerDetail() {
  return <LedgerTable maxHeight="calc(100dvh - 230px)" />;
}
