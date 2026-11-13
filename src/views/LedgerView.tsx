import { FileSpreadsheet } from 'lucide-react';
import { Bars } from '../components/charts/Bars';
import { Button, Eyebrow, Money, SectionTitle } from '../components/ui';
import { LedgerTable } from '../details/LedgerDetail';
import { projectionToCsv } from '../engine/csv';
import type { YearRow } from '../engine/types';
import { C } from '../lib/colors';
import { dateStamp, saveFile } from '../lib/download';
import { useAdjust, useApp } from '../store/context';
import { useDetailNav } from '../store/useDetailNav';

const PHASES: { id: YearRow['phase']; label: string }[] = [
  { id: 'work', label: 'Working' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'retired', label: 'Retired' },
];

export function LedgerView() {
  const { projection, settings, notify } = useApp();
  const adj = useAdjust();
  const nav = useDetailNav();
  const rows = projection.rows;

  const exportCsv = async () => {
    await saveFile(`fin-modeler-projection-${dateStamp()}.csv`, 'text/csv', projectionToCsv(projection, settings.real));
    notify('Projection exported');
  };

  return (
    <div className="anim-rise">
      <div className="card px-3 pt-3 pb-2">
        <Eyebrow className="mb-2 px-1">Net cash flow by age</Eyebrow>
        <Bars
          ariaLabel="Net cash flow by year"
          color={C.accessible}
          negativeColor={C.orange}
          unit="money"
          height={130}
          bars={rows.map((r) => ({ key: String(r.year), value: adj(r.netCashFlow, r.inflOpen), title: `${r.year} · age ${r.age}` }))}
          axis={[rows[0].age, rows[Math.floor((rows.length - 1) / 2)].age, rows[rows.length - 1].age]}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {PHASES.map((p) => {
          const set = rows.filter((r) => r.phase === p.id);
          const net = set.reduce((s, r) => s + adj(r.netCashFlow, r.inflOpen), 0);
          return (
            <div key={p.id} className="card !p-3">
              <Eyebrow>{p.label}</Eyebrow>
              <div className="mt-1.5 text-[17px] font-semibold text-fg">{set.length ? <Money v={net} compact sign /> : '—'}</div>
              <div className="mt-0.5 text-[12px] text-fg3">{set.length} yrs net</div>
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <Button icon={FileSpreadsheet} className="w-full" onClick={() => void exportCsv()}>
          Export year-by-year CSV
        </Button>
      </div>

      {!nav.split && (
        <>
          <SectionTitle>Annual bridge table</SectionTitle>
          <LedgerTable maxHeight="62dvh" />
        </>
      )}
    </div>
  );
}
