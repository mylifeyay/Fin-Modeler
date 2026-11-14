import { Building2, Hourglass, Landmark, Receipt, Target, TrendingUp, Wallet, Wand2, type LucideIcon } from 'lucide-react';
import { BLANK_LABEL, SAMPLE_LABEL } from '../engine/defaults';
import type { ReactNode } from 'react';
import { TimeChart, type ChartMarker } from '../components/charts/TimeChart';
import { Button, Card, Eyebrow, Money, Pill, SectionTitle, Segmented, Slider, Toggle, type Tone } from '../components/ui';
import type { BridgeStatus } from '../engine/analysis';
import { effectiveSaleYear, tenancyEndYear } from '../engine/simulate';
import type { BonusScenario } from '../engine/types';
import { C } from '../lib/colors';
import { percent, ratio } from '../lib/format';
import { useAdjust, useApp, type DetailId } from '../store/context';
import { useDetailNav } from '../store/useDetailNav';

const BRIDGE_TONE: Record<BridgeStatus, Tone> = { none: 'neutral', funded: 'good', tight: 'warning', fails: 'critical' };
const BRIDGE_LABEL: Record<BridgeStatus, string> = { none: 'No bridge', funded: 'Funded', tight: 'Tight', fails: 'Fails' };

function Kpi({ id, icon: Icon, label, children, sub }: { id: DetailId; icon: LucideIcon; label: string; children: ReactNode; sub: ReactNode }) {
  const nav = useDetailNav();
  return (
    <Card onClick={() => nav.open(id)} selected={nav.split && nav.active === id} className="!p-3.5">
      <div className="flex items-center gap-1.5 text-fg3">
        <Icon size={14} strokeWidth={2.2} aria-hidden />
        <Eyebrow className="truncate">{label}</Eyebrow>
      </div>
      <div className="mt-2 flex min-h-[30px] items-center text-[22px] leading-none font-semibold tracking-[-0.02em] text-fg">{children}</div>
      <div className="mt-1.5 truncate text-[12px] text-fg3">{sub}</div>
    </Card>
  );
}

export function OverviewView() {
  const { plan, projection, bridge, mc, settings, update, startYear, setWizard } = useApp();
  const adj = useAdjust();
  const nav = useDetailNav();
  const { profile, statutory: st, property: pr, expenses: ex } = plan;
  const idx = projection.inflIndex;
  const accessible = projection.accessible.map((v, i) => adj(v, idx[i]));
  const headline = projection.headline.map((v, i) => adj(v, idx[i]));
  const row0 = projection.rows[0];
  const lockedShare = headline[0] > 0 ? 1 - accessible[0] / headline[0] : 0;

  const markers: ChartMarker[] = [];
  if (profile.retireAge > profile.currentAge) markers.push({ x: profile.retireAge, label: `Retire ${profile.retireAge}` });
  if (st.enabled && st.unlockAge > profile.currentAge) markers.push({ x: st.unlockAge, label: `Unlock ${st.unlockAge}` });
  if (st.enabled && st.payoutAge > profile.currentAge) markers.push({ x: st.payoutAge, label: `Payout ${st.payoutAge}` });

  const saleYear = effectiveSaleYear(plan, startYear);
  const minSaleYear = Math.max(tenancyEndYear(plan), startYear);
  const inflow = row0.salary + row0.bonus + row0.rentNet + row0.dividends + row0.secondary + row0.statutoryPayout + row0.deferredWithdrawal;
  const savingsRate = inflow > 0 ? row0.netCashFlow / inflow : 0;
  const gross = row0.salary + row0.bonus + Math.max(0, row0.rentNet) + row0.secondary;
  const statutoryNow = st.enabled ? st.oa + st.sa + st.ma + st.ra : 0;

  return (
    <div className="anim-rise">
      {(plan.label.startsWith(SAMPLE_LABEL) || plan.label === BLANK_LABEL) && (
        <div className="card mb-3 !flex items-center justify-between gap-3 !p-3.5">
          <div className="min-w-0 pl-1">
            <div className="text-[14px] font-semibold text-fg">{plan.label === BLANK_LABEL ? 'Your plan is blank' : 'These are sample figures'}</div>
            <div className="mt-0.5 text-[12px] leading-snug text-fg3">Build your own in eight short steps.</div>
          </div>
          <Button icon={Wand2} variant="primary" className="shrink-0 !min-h-[40px] !px-3.5 !text-[14px]" onClick={() => setWizard(true)}>
            Set up
          </Button>
        </div>
      )}
      <Card onClick={() => nav.open('networth')} selected={nav.split && nav.active === 'networth'} label="Net worth breakdown" className="!p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow>Accessible net worth</Eyebrow>
            <div className="mt-1 text-[38px] leading-none font-semibold tracking-[-0.03em] text-fg">
              <Money v={accessible[0]} compact />
            </div>
            <div className="mt-2 text-[13px] text-fg2">
              Headline <Money v={headline[0]} compact className="font-semibold text-fg" /> <span className="text-fg3">· {percent(lockedShare)} locked</span>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-semibold text-fg2">{settings.real ? 'Today’s dollars' : 'Nominal'}</span>
        </div>
      </Card>

      <div className="card mt-3 px-3 pt-3 pb-3">
        <TimeChart
          xs={projection.ages}
          ariaLabel="Headline and accessible net worth by age"
          lines={[
            { id: 'headline', label: 'Headline net worth', color: C.headline, values: headline },
            { id: 'accessible', label: 'Accessible net worth', color: C.accessible, values: accessible, area: true },
          ]}
          markers={markers}
          zone={bridge.status !== 'none' ? { from: bridge.fromAge, to: bridge.toAge, label: 'Bridge years' } : undefined}
          xCaption={(age) => `Age ${age} · ${startYear + age - profile.currentAge}`}
        />
      </div>

      <SectionTitle>Scenario</SectionTitle>
      <div className="card px-4 py-2.5">
        <Slider
          label="Retire at"
          value={profile.retireAge}
          min={Math.min(profile.currentAge, 40)}
          max={70}
          onChange={(v) => update((d) => void (d.profile.retireAge = v))}
          format={(v) => `Age ${v}`}
          hint={st.enabled && profile.retireAge < st.unlockAge ? `${st.unlockAge - Math.max(profile.retireAge, profile.currentAge)} bridge years before the age-${st.unlockAge} unlock` : undefined}
        />
        {ex.retirementMode === 'multiplier' ? (
          <Slider
            label="Retirement spending"
            value={ex.retirementMultiplier}
            min={40}
            max={150}
            step={5}
            onChange={(v) => update((d) => void (d.expenses.retirementMultiplier = v))}
            format={(v) => `${v}% of today’s`}
          />
        ) : (
          <Slider
            label="Retirement budget"
            value={ex.retirementCustomMonthly}
            min={1000}
            max={20000}
            step={250}
            onChange={(v) => update((d) => void (d.expenses.retirementCustomMonthly = v))}
            format={(v) => (
              <>
                <Money v={v} /> / mo
              </>
            )}
          />
        )}
        <div className="pt-1 pb-2">
          <div className="mb-1.5 text-[14px] text-fg2">Bonus band, months of salary</div>
          <Segmented<BonusScenario>
            label="Bonus scenario"
            value={plan.income.bonusScenario}
            onChange={(v) => update((d) => void (d.income.bonusScenario = v))}
            options={[
              { value: 'low', label: `Low · ${plan.income.bonusLowMonths}` },
              { value: 'base', label: `Base · ${plan.income.bonusBaseMonths}` },
              { value: 'high', label: `High · ${plan.income.bonusHighMonths}` },
            ]}
          />
        </div>
        {pr.enabled && (
          <>
            <Toggle label="Sell the property" checked={pr.sell} onChange={(v) => update((d) => void (d.property.sell = v))} hint={pr.sell ? undefined : 'Held to the end of the plan. Equity stays locked.'} />
            {pr.sell && (
              <Slider
                label="Sale year"
                value={saleYear ?? minSaleYear}
                min={minSaleYear}
                max={startYear + Math.min(40, profile.endAge - profile.currentAge - 1)}
                onChange={(v) => update((d) => void (d.property.sellYear = v))}
                format={(v) => `${v} · age ${v - startYear + profile.currentAge}`}
              />
            )}
          </>
        )}
      </div>

      <SectionTitle>Breakdowns</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          id="bridge"
          icon={Hourglass}
          label="Liquidity bridge"
          sub={
            bridge.status === 'none'
              ? 'Retirement is not before unlock'
              : bridge.status === 'fails'
                ? `Runs dry at age ${bridge.firstShortfallAge}`
                : `${bridge.years} yrs · low point ${Number.isFinite(bridge.runwayAtLow) ? ratio(bridge.runwayAtLow) : '∞'} annual spend`
          }
        >
          <Pill tone={BRIDGE_TONE[bridge.status]}>{BRIDGE_LABEL[bridge.status]}</Pill>
        </Kpi>
        <Kpi
          id="success"
          icon={Target}
          label="Success odds"
          sub={mc.result ? (mc.result.bridgeSurvival === null ? `${mc.result.runs.toLocaleString('en-US')} paths` : `Bridge survival ${percent(mc.result.bridgeSurvival)}`) : 'Simulating…'}
        >
          <span className={`num ${mc.stale || mc.status === 'running' ? 'opacity-50' : ''}`}>{mc.result ? percent(mc.result.successRate) : '—'}</span>
        </Kpi>
        <Kpi id="networth" icon={TrendingUp} label={`Net worth at ${profile.endAge}`} sub={projection.firstShortfallAge !== null ? `Runs dry at age ${projection.firstShortfallAge}` : 'Deterministic path'}>
          <Money v={headline[headline.length - 1]} compact />
        </Kpi>
        <Kpi id="cashflow" icon={Wallet} label={`Cash flow ${startYear}`} sub={row0.netCashFlow >= 0 ? `Saving ${percent(savingsRate)} of income` : 'Drawing on assets'}>
          <Money v={row0.netCashFlow} compact sign />
        </Kpi>
        {pr.enabled && (
          <Kpi id="property" icon={Building2} label="Property equity" sub={pr.sell && saleYear ? `Sale planned ${saleYear}` : 'Hold vs sell comparator'}>
            <Money v={pr.marketValue - pr.mortgageBalance} compact />
          </Kpi>
        )}
        {st.enabled && (
          <Kpi id="locked" icon={Landmark} label="Statutory accounts" sub={profile.currentAge < st.unlockAge ? `Locked until age ${st.unlockAge}` : `Payout from age ${st.payoutAge}`}>
            <Money v={statutoryNow} compact />
          </Kpi>
        )}
        <Kpi id="tax" icon={Receipt} label={`Tax ${startYear}`} sub={gross > 0 ? `Effective ${percent(row0.tax / gross, 1)}` : 'No taxable income'}>
          <Money v={row0.tax} compact />
        </Kpi>
      </div>
    </div>
  );
}
