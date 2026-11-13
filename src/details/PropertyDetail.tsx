import { useMemo, useState } from 'react';
import { SegBar } from '../components/charts/SegBar';
import { TimeChart } from '../components/charts/TimeChart';
import { Button, Group, Money, Note, Row, Slider } from '../components/ui';
import { compareHoldSell, saleSchedule } from '../engine/analysis';
import { monthlyInstalment, tenancyEndYear } from '../engine/simulate';
import { C } from '../lib/colors';
import { percent } from '../lib/format';
import { useAdjust, useApp } from '../store/context';

export function PropertyDetail() {
  const { plan, startYear, update, setDetail, notify } = useApp();
  const adj = useAdjust();
  const pr = plan.property;
  const { profile, statutory: st } = plan;
  const lockYear = Math.max(tenancyEndYear(plan), startYear);
  const maxYear = startYear + Math.min(40, profile.endAge - profile.currentAge - 1);
  const [picked, setPicked] = useState<number | null>(null);
  const saleYear = Math.min(maxYear, Math.max(lockYear, picked ?? pr.sellYear));

  const schedule = useMemo(() => saleSchedule(plan, startYear), [plan, startYear]);
  const cmp = useMemo(() => compareHoldSell(plan, startYear, saleYear), [plan, startYear, saleYear]);

  if (!pr.enabled || !cmp) {
    return (
      <div className="space-y-3">
        <Note>The property module is off. Net worth is modelled on liquid and statutory assets only.</Note>
        <Button variant="primary" onClick={() => setDetail('edit-property')}>
          Set up a property
        </Button>
      </div>
    );
  }

  const sale = cmp.sale;
  const idx = sale?.inflClose ?? 1;
  const xs = cmp.hold.ages;
  const holdAcc = cmp.hold.accessible.map((v, i) => adj(v, cmp.hold.inflIndex[i]));
  const sellAcc = cmp.sell.accessible.map((v, i) => adj(v, cmp.sell.inflIndex[i]));
  const last = cmp.milestones[cmp.milestones.length - 1];
  const grossYield = pr.marketValue > 0 ? (pr.monthlyRent * 12) / pr.marketValue : 0;
  const rows = schedule.filter((r) => r.year >= lockYear && (r.year - lockYear) % 5 === 0).slice(0, 8);

  return (
    <div>
      <Group title="Target sale year" note={lockYear > startYear ? `The tenancy lock-in runs to ${pr.tenancyEnd}. A sale is not possible before ${lockYear}.` : undefined}>
        <Slider label="Sell in" value={saleYear} min={lockYear} max={maxYear} onChange={setPicked} format={(v) => `${v} · age ${v - startYear + profile.currentAge}`} />
      </Group>

      {sale && (
        <Group title={`Net proceeds on sale, ${sale.year}`} note="The statutory refund ranks first and is capped at net proceeds. Only what remains is spendable.">
          <Row label="Market value" hint={`${pr.appreciation}% p.a. from today`}>
            <Money v={adj(sale.value, idx)} />
          </Row>
          <Row label="Selling costs" hint={`${pr.sellingCostPct}% of price`}>
            <Money v={-adj(sale.sellingCosts, idx)} />
          </Row>
          <Row label="Outstanding mortgage">
            <Money v={-adj(sale.mortgage, idx)} />
          </Row>
          <Row label="Net sale proceeds" strong>
            <Money v={adj(sale.netProceeds, idx)} />
          </Row>
          {st.enabled && (
            <>
              <Row label="Statutory principal used" indent>
                <Money v={adj(sale.housingPrincipal, idx)} />
              </Row>
              <Row label="Accrued interest" indent hint={`${pr.accruedRate}% p.a. compounding`}>
                <Money v={adj(sale.housingAccrued, idx)} />
              </Row>
              <Row label="Refunded to locked account" hint="Principal plus accrued interest, capped at net proceeds" swatch={C.locked}>
                <Money v={adj(sale.refund, idx)} />
              </Row>
            </>
          )}
          <Row label="Free cash unlocked" hint="Flows into accessible net worth" strong swatch={C.accessible}>
            <Money v={adj(sale.freeCash, idx)} />
          </Row>
          <div className="pt-2 pb-2">
            <SegBar
              ariaLabel="Split of net sale proceeds"
              segments={[
                { label: 'Refunded to locked account', value: Math.max(0, adj(sale.refund, idx)), color: C.locked },
                { label: 'Free cash unlocked', value: Math.max(0, adj(sale.freeCash, idx)), color: C.accessible },
              ]}
            />
          </div>
        </Group>
      )}

      <Group title={`Hold vs sell in ${cmp.saleYear}`}>
        <div className="pt-2">
          <TimeChart
            xs={xs}
            height={190}
            ariaLabel="Accessible net worth, hold versus sell"
            lines={[
              { id: 'sell', label: `Sell ${cmp.saleYear}`, color: C.accessible, values: sellAcc },
              { id: 'hold', label: 'Hold', color: C.property, values: holdAcc },
            ]}
            markers={[{ x: cmp.saleAge + 1, label: `Sale ${cmp.saleYear}` }]}
          />
        </div>
        <div className="mt-2 grid grid-cols-[auto_1fr_1fr_1fr] gap-x-3 gap-y-1.5 border-t border-line pt-2.5 pb-1 text-right text-[12.5px]">
          <span className="text-left text-fg3">Age</span>
          <span className="text-fg3">Hold</span>
          <span className="text-fg3">Sell</span>
          <span className="text-fg3">Sell − hold</span>
          {cmp.milestones.map((m) => (
            <div key={m.age} className="contents">
              <span className="num text-left text-fg2">{m.age}</span>
              <Money v={adj(m.holdAccessible, m.infl)} compact className="text-fg" />
              <Money v={adj(m.sellAccessible, m.infl)} compact className="text-fg" />
              <Money v={adj(m.sellAccessible - m.holdAccessible, m.infl)} compact sign className="font-semibold text-fg" />
            </div>
          ))}
        </div>
        <div className="mt-1 text-[12px] text-fg3">Accessible net worth. Selling converts locked equity into spendable assets and ends the rent.</div>
        {last && (
          <Row label={`Headline net worth at ${last.age}`} hint="Sell − hold, total wealth including the property">
            <Money v={adj(last.sellHeadline - last.holdHeadline, last.infl)} compact sign />
          </Row>
        )}
        <div className="flex gap-2 pt-2 pb-2">
          <Button
            className="flex-1"
            onClick={() => {
              update((d) => void (d.property.sell = false));
              notify('Plan set to hold');
            }}
            disabled={!pr.sell}
          >
            Plan to hold
          </Button>
          <Button
            className="flex-1"
            variant="primary"
            onClick={() => {
              update((d) => {
                d.property.sell = true;
                d.property.sellYear = saleYear;
              });
              notify(`Plan set to sell in ${saleYear}`);
            }}
            disabled={pr.sell && pr.sellYear === saleYear}
          >
            Plan to sell {saleYear}
          </Button>
        </div>
      </Group>

      {st.enabled && rows.length > 1 && (
        <Group title="Accrued interest erosion" note="Every year held, the refund owed to the locked account compounds. The owner’s share of proceeds is what is left.">
          <div className="scroll-x -mx-1">
            <table className="num w-full min-w-[340px] border-collapse text-right text-[12.5px]">
              <thead>
                <tr className="text-fg3">
                  <th className="py-1.5 pl-1 text-left font-medium">Sale</th>
                  <th className="px-2 font-medium">Net proceeds</th>
                  <th className="px-2 font-medium">Refund</th>
                  <th className="px-2 font-medium">Free cash</th>
                  <th className="pr-1 pl-2 font-medium">Free %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className={`border-t border-line ${r.year === saleYear ? 'font-semibold' : ''} text-fg`}>
                    <td className="py-1.5 pl-1 text-left text-fg2">{r.year}</td>
                    <td className="px-2">
                      <Money v={adj(r.netProceeds, r.inflClose)} compact />
                    </td>
                    <td className="px-2">
                      <Money v={adj(r.refund, r.inflClose)} compact />
                    </td>
                    <td className="px-2">
                      <Money v={adj(r.freeCash, r.inflClose)} compact />
                    </td>
                    <td className="pr-1 pl-2">{r.netProceeds > 0 ? percent(r.freeCash / r.netProceeds) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Group>
      )}

      <Group title="Carrying the property today">
        <Row label="Gross rental yield">{percent(grossYield, 1)}</Row>
        <Row label="Mortgage instalment" hint={`${pr.oaSharePct}% from the ordinary account`}>
          <Money v={monthlyInstalment(plan)} /> / mo
        </Row>
        <Row label="Unrealised gain on cost">
          <Money v={pr.marketValue - pr.purchaseCost} sign />
        </Row>
      </Group>
    </div>
  );
}
