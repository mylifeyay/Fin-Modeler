import { TimeChart } from '../components/charts/TimeChart';
import { Button, Group, Money, Note, Row } from '../components/ui';
import { C } from '../lib/colors';
import { useAdjust, useApp } from '../store/context';

export function LockedDetail() {
  const { plan, projection, setDetail } = useApp();
  const adj = useAdjust();
  const st = plan.statutory;
  const { profile } = plan;
  if (!st.enabled) {
    return (
      <div className="space-y-3">
        <Note>The statutory accounts module is off.</Note>
        <Button variant="primary" onClick={() => setDetail('edit-statutory')}>
          Set up statutory accounts
        </Button>
      </div>
    );
  }
  const rows = projection.rows;
  const xs = rows.map((r) => r.age + 1);
  const series = (get: (r: (typeof rows)[number]) => number) => rows.map((r) => adj(get(r), r.inflClose));
  const unlockRow = rows.find((r) => r.age === st.unlockAge);
  const before = rows.find((r) => r.age === st.unlockAge - 1);
  const payoutRow = rows.find((r) => r.age === st.payoutAge);
  const firstOverflow = rows.find((r) => r.maOverflow > 0);
  const overflowTotal = rows.reduce((s, r) => s + adj(r.maOverflow, r.inflOpen), 0);
  const row0 = rows[0];
  const table = rows.filter((r) => r.age % 5 === 0 || r.t === 0 || r.age === st.unlockAge || r.age === st.payoutAge);

  return (
    <div>
      <Group title="Balances today">
        <Row label="Ordinary account" hint={`${st.oaRate}% p.a. Can service the mortgage.`} swatch={C.headline}>
          <Money v={st.oa} />
        </Row>
        <Row label="Special account" hint={`${st.saRate}% p.a.`} swatch={C.locked}>
          <Money v={st.sa} />
        </Row>
        <Row label="Healthcare account" hint={`${st.maRate}% p.a. Capped at the healthcare ceiling.`} swatch={C.property}>
          <Money v={st.ma} />
        </Row>
        {st.ra > 0 && (
          <Row label="Retirement account" swatch={C.locked}>
            <Money v={st.ra} />
          </Row>
        )}
        <Row label="Total" strong>
          <Money v={st.oa + st.sa + st.ma + st.ra} />
        </Row>
      </Group>

      <div className="card mt-3 px-3 pt-3 pb-3">
        <TimeChart
          xs={xs}
          height={190}
          ariaLabel="Statutory account balances by age"
          lines={[
            { id: 'oa', label: 'Ordinary', color: C.headline, values: series((r) => r.oa) },
            { id: 'sa', label: 'Special / retirement', color: C.locked, values: series((r) => r.sa + r.ra + r.annuity) },
            { id: 'ma', label: 'Healthcare', color: C.property, values: series((r) => r.ma) },
          ]}
          markers={[
            ...(st.unlockAge > profile.currentAge ? [{ x: st.unlockAge, label: `Unlock ${st.unlockAge}` }] : []),
            ...(st.payoutAge > profile.currentAge ? [{ x: st.payoutAge, label: `Payout ${st.payoutAge}` }] : []),
          ]}
        />
      </div>

      <Group title={`Contributions this year`}>
        <Row label="Employee" hint={`${st.employeeRate}% of wages up to the ceiling`}>
          <Money v={row0.employeeContribution} />
        </Row>
        <Row label="Employer" hint={`${st.employerRate}%`}>
          <Money v={row0.employerContribution} />
        </Row>
        <Row label="Healthcare overflow" hint="Contributions and interest above the ceiling, rerouted">
          <Money v={row0.maOverflow} />
        </Row>
        <Row label="Mortgage paid from ordinary account">
          <Money v={-row0.mortgageOa} />
        </Row>
      </Group>

      <Group
        title="Healthcare ceiling"
        note={`Once the healthcare account reaches the ceiling, the excess flows to the special or retirement account up to the retirement sum, then to the ordinary account.`}
      >
        <Row label="Ceiling today" hint={`Grows ${st.maCapGrowth}% p.a. until age ${st.payoutAge}`}>
          <Money v={st.maCap} />
        </Row>
        <Row label="First overflow">{firstOverflow ? `Age ${firstOverflow.age}` : 'Never reached'}</Row>
        <Row label="Lifetime overflow rerouted">
          <Money v={overflowTotal} compact />
        </Row>
      </Group>

      {unlockRow && before && (
        <Group title={`Unlock at age ${st.unlockAge}`} note={`The ${st.lockIn === 'ERS' ? 'enhanced' : 'full'} retirement sum is set aside in the retirement account. Everything above it becomes accessible.`}>
          <Row label="Statutory balances the day before">
            <Money v={adj(before.statutoryTotal, before.inflClose)} />
          </Row>
          <Row label="Locked into retirement account">
            <Money v={-adj(before.oa + before.sa - (unlockRow.accessibleOpen - before.accessible), before.inflClose)} />
          </Row>
          <Row label="Stays in healthcare account">
            <Money v={-adj(before.ma, before.inflClose)} />
          </Row>
          <Row label="Released into accessible net worth" strong>
            <Money v={adj(unlockRow.accessibleOpen - before.accessible, unlockRow.inflOpen)} />
          </Row>
        </Group>
      )}

      {payoutRow && (
        <Group title={`Lifetime payout from age ${st.payoutAge}`} note={`${st.payoutRate}% a year of the retirement account balance at conversion, level in nominal terms, paid for life.`}>
          <Row label="Annuity premium at conversion">
            <Money v={adj(payoutRow.annuity + payoutRow.statutoryPayout, payoutRow.inflOpen)} />
          </Row>
          <Row label="Monthly payout" strong>
            <Money v={adj(payoutRow.statutoryPayout / 12, payoutRow.inflOpen)} /> / mo
          </Row>
        </Group>
      )}

      <Group title="Schedule">
        <div className="scroll-x -mx-1">
          <table className="num w-full min-w-[340px] border-collapse text-right text-[12.5px]">
            <thead>
              <tr className="text-fg3">
                <th className="py-1.5 pl-1 text-left font-medium">Age</th>
                <th className="px-2 font-medium">Ordinary</th>
                <th className="px-2 font-medium">Special / RA</th>
                <th className="px-2 font-medium">Healthcare</th>
                <th className="pr-1 pl-2 font-medium">Payout</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.age} className="border-t border-line text-fg">
                  <td className="py-1.5 pl-1 text-left text-fg2">{r.age}</td>
                  <td className="px-2">
                    <Money v={adj(r.oa, r.inflClose)} compact />
                  </td>
                  <td className="px-2">
                    <Money v={adj(r.sa + r.ra + r.annuity, r.inflClose)} compact />
                  </td>
                  <td className="px-2">
                    <Money v={adj(r.ma, r.inflClose)} compact />
                  </td>
                  <td className="pr-1 pl-2">
                    <Money v={adj(r.statutoryPayout, r.inflOpen)} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Group>
    </div>
  );
}
