import { Bars } from '../components/charts/Bars';
import { Group, Money, Note, Pill, Row } from '../components/ui';
import { C } from '../lib/colors';
import { compact, percent } from '../lib/format';
import { useApp } from '../store/context';

export function SuccessDetail() {
  const { mc, plan, settings } = useApp();
  const r = mc.result;
  if (!r) {
    return <Note>{mc.status === 'error' ? (mc.error ?? 'The simulation failed.') : 'Running the first simulation in a background worker…'}</Note>;
  }
  const failures = r.runs - Math.round(r.successRate * r.runs);
  const depletion = r.depletionByAge.map((count, i) => ({ age: r.ages[i], count })).filter((d) => d.count > 0);
  const firstAge = depletion.length ? depletion[0].age : null;
  const mid = Math.floor(r.endingReal.length / 2);
  const bands = settings.real ? r.accessible.real : r.accessible.nominal;
  const { profile, statutory: st } = plan;
  const ages = [...new Set([profile.retireAge, st.enabled ? st.unlockAge : -1, st.enabled ? st.payoutAge : -1, 80, profile.endAge])]
    .filter((a) => a > profile.currentAge && a <= profile.endAge)
    .sort((a, b) => a - b);
  const tone = r.successRate >= 0.9 ? 'good' : r.successRate >= 0.75 ? 'warning' : 'critical';

  return (
    <div className={mc.stale || mc.status === 'running' ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <div className="card p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="num text-[40px] leading-none font-semibold tracking-[-0.03em] text-fg">{percent(r.successRate, 1)}</div>
            <div className="mt-1.5 text-[13px] text-fg2">of paths never run out of accessible money by age {profile.endAge}</div>
          </div>
          <Pill tone={tone}>{tone === 'good' ? 'Looking good' : tone === 'warning' ? 'A bit exposed' : 'Needs attention'}</Pill>
        </div>
      </div>

      <Group title="Outcome summary">
        <Row label="Paths simulated" hint={`Seed ${plan.monteCarlo.seed} · ${Math.round(r.elapsedMs)} ms in a Web Worker`}>
          {r.runs.toLocaleString('en-US')}
        </Row>
        <Row label="Probability of success">{percent(r.successRate, 1)}</Row>
        <Row label="Bridge survival rate" hint={r.bridgeSurvival === null ? 'No years between retirement and unlock' : `Age ${Math.max(profile.retireAge, profile.currentAge)} to ${st.unlockAge}`}>
          {r.bridgeSurvival === null ? '—' : percent(r.bridgeSurvival, 1)}
        </Row>
        <Row label="Paths that run dry" hint={firstAge !== null ? `Earliest at age ${firstAge}` : undefined}>
          {failures.toLocaleString('en-US')}
        </Row>
      </Group>

      <Group title={`Accessible net worth at ${profile.endAge}`} note="Distribution across all paths, in today’s dollars. The last bar collects every path above the 90th percentile.">
        <div className="pt-2">
          <Bars
            ariaLabel="Distribution of ending accessible net worth"
            color={C.accessible}
            unit="count"
            bars={r.endingReal.map((b, i) => ({
              key: String(i),
              value: b.count,
              title: settings.privacy ? '•••' : i === r.endingReal.length - 1 ? `$${compact(b.from)} and above` : `$${compact(b.from)} to $${compact(b.to)}`,
            }))}
            axis={[
              <Money key="a" v={r.endingReal[0].from} compact />,
              <Money key="b" v={r.endingReal[mid].from} compact />,
              <span key="c">
                <Money v={r.endingReal[r.endingReal.length - 1].from} compact />+
              </span>,
            ]}
          />
        </div>
        <Row label="10th percentile">
          <Money v={r.endingRealP10} compact />
        </Row>
        <Row label="Median">
          <Money v={r.endingRealMedian} compact />
        </Row>
        <Row label="90th percentile">
          <Money v={r.endingRealP90} compact />
        </Row>
      </Group>

      {depletion.length > 0 && (
        <Group title="When failing paths run dry" note="Age at which accessible assets first fail to cover spending.">
          <div className="pt-2">
            <Bars
              ariaLabel="Count of paths running dry by age"
              color={C.red}
              unit="count"
              height={120}
              bars={r.depletionByAge.slice(0, -1).map((count, i) => ({ key: String(i), value: count, title: `Age ${r.ages[i]}` }))}
              axis={[r.ages[0], r.ages[Math.floor(r.ages.length / 2)], r.ages[r.ages.length - 2]]}
            />
          </div>
        </Group>
      )}

      <Group title="Accessible net worth percentiles" note={settings.real ? 'Today’s dollars.' : 'Nominal dollars.'}>
        <div className="grid grid-cols-4 gap-x-3 gap-y-1.5 py-1.5 text-right text-[13px]">
          <span className="text-left text-fg3">Age</span>
          <span className="text-fg3">P10</span>
          <span className="text-fg3">P50</span>
          <span className="text-fg3">P90</span>
          {ages.map((age) => {
            const i = age - profile.currentAge;
            return (
              <div key={age} className="contents">
                <span className="num text-left text-fg2">{age}</span>
                <Money v={bands.p10[i]} compact className="text-fg" />
                <Money v={bands.p50[i]} compact className="text-fg" />
                <Money v={bands.p90[i]} compact className="text-fg" />
              </div>
            );
          })}
        </div>
      </Group>

      <div className="mt-4">
        <Note>
          Each path draws lognormal returns per asset class, correlated domestic and foreign equities, an FX shock, noisy inflation, and a bonus between the low and high band. Expected returns are read as
          compound rates, so each bucket’s median path matches the deterministic projection.
        </Note>
      </div>
    </div>
  );
}
