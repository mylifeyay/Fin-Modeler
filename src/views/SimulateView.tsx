import { Play, Shuffle } from 'lucide-react';
import { TimeChart, type ChartMarker } from '../components/charts/TimeChart';
import { Ring } from '../components/Friendly';
import { Button, Card, Chevron, Eyebrow, Note, Pill, SectionTitle, Segmented, type Tone } from '../components/ui';
import type { PercentileBands } from '../engine/types';
import { C } from '../lib/colors';
import { percent } from '../lib/format';
import { useAdjust, useApp } from '../store/context';
import { useDetailNav } from '../store/useDetailNav';

function Fan({ title, bands, color, ages, deterministic, markers }: { title: string; bands: PercentileBands; color: string; ages: number[]; deterministic: number[]; markers: ChartMarker[] }) {
  // Sixty years of compounding makes the top decile dwarf everything else. Scale the axis to
  // the inner band so the downside stays readable, and let the P90 band run off the top.
  const focus = Math.max(...bands.p75, ...deterministic) * 1.15;
  const capped = Math.max(...bands.p90) > focus * 1.2;
  return (
    <div className="card px-3 pt-3 pb-3">
      <Eyebrow className="mb-1 px-1">{title}</Eyebrow>
      <TimeChart
        xs={ages}
        height={210}
        yCap={capped ? focus : undefined}
        ariaLabel={`${title}: percentile fan chart`}
        bands={[
          { id: 'outer', label: 'P10 to P90', color, lo: bands.p10, hi: bands.p90, opacity: 0.16 },
          { id: 'inner', label: 'P25 to P75', color, lo: bands.p25, hi: bands.p75, opacity: 0.3 },
        ]}
        lines={[
          { id: 'p50', label: 'Median (P50)', color, values: bands.p50 },
          { id: 'det', label: 'Deterministic', color: 'var(--fg2)', values: deterministic, dashed: true },
        ]}
        markers={markers}
        tooltipRows={(i) => [
          { label: 'P90', value: bands.p90[i] },
          { label: 'P75', value: bands.p75[i] },
          { label: 'Median', value: bands.p50[i], color },
          { label: 'P25', value: bands.p25[i] },
          { label: 'P10', value: bands.p10[i] },
          { label: 'Deterministic', value: deterministic[i], color: 'var(--fg2)' },
        ]}
      />
      {capped && <div className="mt-1.5 px-1 text-[12px] leading-snug text-fg3">The axis is scaled to the P25 to P75 band. P90 runs off the top. Scrub the chart for exact values.</div>}
    </div>
  );
}

export function SimulateView() {
  const { mc, plan, projection, settings, update, runMc } = useApp();
  const adj = useAdjust();
  const nav = useDetailNav();
  const r = mc.result;
  const { profile, statutory: st } = plan;
  const busy = mc.status === 'running';
  const tone: Tone = !r ? 'neutral' : r.successRate >= 0.9 ? 'good' : r.successRate >= 0.75 ? 'warning' : 'critical';
  const markers: ChartMarker[] = [];
  if (profile.retireAge > profile.currentAge) markers.push({ x: profile.retireAge, label: `Retire ${profile.retireAge}` });
  if (st.enabled && st.unlockAge > profile.currentAge) markers.push({ x: st.unlockAge, label: `Unlock ${st.unlockAge}` });
  const aligned = r !== null && r.ages.length === projection.ages.length;
  const detAcc = projection.accessible.map((v, i) => adj(v, projection.inflIndex[i]));
  const detHead = projection.headline.map((v, i) => adj(v, projection.inflIndex[i]));

  return (
    <div className="anim-rise">
      <Card onClick={() => nav.open('success')} selected={nav.split && nav.active === 'success'} label="Monte Carlo outcome detail" className="!p-4">
        <div className="flex items-center gap-4">
          <Ring value={r ? r.successRate : null} tone={tone} size={104}>
            <span className={`num text-[24px] font-bold tracking-[-0.02em] text-fg transition-opacity ${busy || mc.stale ? 'opacity-50' : ''}`}>{r ? percent(r.successRate) : '\u2014'}</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-fg2">Odds your money lasts</div>
            <div className="mt-1 text-[15px] leading-snug text-fg">{r ? `${Math.round(r.successRate * 100)} in 100 simulated futures make it to age ${profile.endAge}.` : 'Rolling the dice on thousands of futures\u2026'}</div>
            <div className="mt-2 flex items-center gap-2">
              <Pill tone={tone}>{!r ? 'Working on it' : tone === 'good' ? 'Looking good' : tone === 'warning' ? 'A bit exposed' : 'Needs attention'}</Pill>
              <Chevron />
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <div className="text-[12px] text-fg3">Bridge years survived</div>
            <div className="num mt-0.5 text-[20px] font-semibold text-fg">{r ? (r.bridgeSurvival === null ? 'n/a' : percent(r.bridgeSurvival, 1)) : '—'}</div>
          </div>
          <div>
            <div className="text-[12px] text-fg3">Futures simulated</div>
            <div className="num mt-0.5 text-[20px] font-semibold text-fg">{r ? r.runs.toLocaleString('en-US') : '—'}</div>
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-raised" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width,opacity] duration-200" style={{ width: `${(busy ? mc.progress : 1) * 100}%`, opacity: busy ? 1 : 0 }} />
        </div>
      </Card>

      <SectionTitle>Roll again</SectionTitle>
      <div className="card px-4 py-3">
        <Segmented
          label="Number of simulated paths"
          value={plan.monteCarlo.runs}
          onChange={(v) => update((d) => void (d.monteCarlo.runs = v))}
          options={[
            { value: 1000, label: '1,000' },
            { value: 2000, label: '2,000' },
            { value: 3000, label: '3,000' },
            { value: 5000, label: '5,000' },
          ]}
        />
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" icon={Play} variant="primary" onClick={() => runMc()} disabled={busy}>
            {busy ? `Running ${percent(mc.progress)}` : 'Run again'}
          </Button>
          <Button className="flex-1" icon={Shuffle} onClick={() => runMc(true)} disabled={busy}>
            New seed
          </Button>
        </div>
        <div className="mt-2.5 text-[12px] leading-snug text-fg3">Runs in a background Web Worker and re-runs when the plan changes. The same seed reproduces the same result.</div>
      </div>

      {mc.status === 'error' && (
        <div className="mt-3">
          <Note tone="critical">{mc.error}</Note>
        </div>
      )}

      {r && aligned && (
        <>
          <SectionTitle>Range of futures · {settings.real ? 'today’s dollars' : 'nominal'}</SectionTitle>
          <div className={`space-y-3 transition-opacity ${busy || mc.stale ? 'opacity-60' : ''}`}>
            <Fan title="Accessible net worth" bands={settings.real ? r.accessible.real : r.accessible.nominal} color={C.accessible} ages={r.ages} deterministic={detAcc} markers={markers} />
            <Fan title="Total net worth" bands={settings.real ? r.headline.real : r.headline.nominal} color={C.headline} ages={r.ages} deterministic={detHead} markers={markers} />
          </div>
        </>
      )}
      {!r && mc.status !== 'error' && (
        <div className="mt-3">
          <Note>Running the first simulation…</Note>
        </div>
      )}
    </div>
  );
}
