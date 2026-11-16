import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { N } from '../details/Editors';
import { analyzeBridge, type BridgeStatus } from '../engine/analysis';
import { BLANK_LABEL, CUSTOM_LABEL, SAMPLE_LABEL, blankPlan } from '../engine/defaults';
import { grossMonthlySalary, monthlyInstalment, project } from '../engine/simulate';
import type { Plan } from '../engine/types';
import { useLayoutMode } from '../hooks/useViewport';
import { BUCKET_LABEL, C } from '../lib/colors';
import { AppContext, useAdjust, useApp, type AppState } from '../store/context';
import { TimeChart, type ChartMarker } from './charts/TimeChart';
import { Says } from './Friendly';
import { Button, Eyebrow, Grid2, Group, Money, Note, Pill, Row, Segmented, Slider, TextField, Toggle, type Tone } from './ui';

const BRIDGE_TONE: Record<BridgeStatus, Tone> = { none: 'neutral', funded: 'good', tight: 'warning', fails: 'critical' };
const BRIDGE_LABEL: Record<BridgeStatus, string> = { none: 'No bridge needed', funded: 'Bridge funded', tight: 'Bridge tight', fails: 'Bridge fails' };

/* ---------- Steps. Each one reads and writes the draft through useApp(). ---------- */

function StepWelcome({ fromCurrent }: { fromCurrent: boolean }) {
  return (
    <div>
      <Says mood="wave" size={84}>
        <span className="font-semibold">Hi, I’m Pip, your nest egg.</span> <span className="text-fg2">Eight short steps and we’ll have your plan. Rough numbers are fine. Skip anything you like and tidy up later under Plan.</span>
      </Says>
      <Group title="Have these to hand">
        <ul className="list-disc space-y-1.5 py-2 pl-4 text-[14px] leading-snug text-fg2">
          <li>Monthly salary and a typical bonus</li>
          <li>Monthly spending</li>
          <li>Balances: cash, investments, statutory accounts</li>
          <li>Property value, mortgage balance and rent, if you own one</li>
        </ul>
      </Group>
      <div className="mt-4 space-y-3">
        <Note tone="good">Everything you enter stays on this device. Nothing is uploaded. Nothing is saved to your plan until you tap Finish.</Note>
        <Note>{fromCurrent ? 'Starting from your current plan. Finishing updates it in place.' : 'Starting from a blank plan with standard assumptions. Finishing replaces the plan now on this device.'}</Note>
      </div>
    </div>
  );
}

function StepYou() {
  const { plan, update, startYear } = useApp();
  const p = plan.profile;
  const st = plan.statutory;
  const gap = st.unlockAge - Math.max(p.retireAge, p.currentAge);
  return (
    <div>
      <Group title="Timeline" note="The plan runs one year at a time from today to the final age.">
        <Slider label="Your age today" value={p.currentAge} min={18} max={80} onChange={(v) => update((d) => void ((d.profile.currentAge = v), (d.profile.retireAge = Math.max(d.profile.retireAge, v)), (d.profile.endAge = Math.max(d.profile.endAge, v + 1))))} />
        <Slider label="Stop working at" value={p.retireAge} min={p.currentAge} max={75} onChange={(v) => update((d) => void (d.profile.retireAge = v))} format={(v) => `Age ${v} · ${startYear + v - p.currentAge}`} />
        <Slider label="Plan to age" value={p.endAge} min={Math.max(80, p.currentAge + 1)} max={105} onChange={(v) => update((d) => void (d.profile.endAge = v))} />
      </Group>
      {st.enabled && gap > 0 && (
        <div className="mt-4">
          <Note>
            Retiring at {p.retireAge} leaves {gap} years before statutory savings unlock at {st.unlockAge}. Only accessible assets can fund those years. The app calls this the liquidity bridge.
          </Note>
        </div>
      )}
    </div>
  );
}

function StepIncome() {
  const { plan, update } = useApp();
  const inc = plan.income;
  return (
    <div>
      <Group title="Salary">
        <N label={`Monthly salary (${inc.salaryIsGross ? 'gross' : 'take-home'})`} money get={(p) => p.income.salaryMonthly} set={(d, v) => (d.income.salaryMonthly = v)} />
        <div className="py-2">
          <Segmented<'gross' | 'net'>
            label="Salary basis"
            value={inc.salaryIsGross ? 'gross' : 'net'}
            onChange={(v) => update((d) => void (d.income.salaryIsGross = v === 'gross'))}
            options={[
              { value: 'gross', label: 'Gross' },
              { value: 'net', label: 'Take-home' },
            ]}
          />
        </div>
        {!inc.salaryIsGross && plan.statutory.enabled && inc.salaryMonthly > 0 && (
          <Row label="Implied gross" hint="Grossed up for the employee statutory contribution">
            <Money v={grossMonthlySalary(plan)} />
          </Row>
        )}
        <N label="Expected yearly raise" pct get={(p) => p.income.salaryGrowth} set={(d, v) => (d.income.salaryGrowth = v)} />
      </Group>
      <Group title="Annual bonus, in months of salary" note="A poor year, a typical year, a strong year. Leave at zero if you get none.">
        <div className="grid grid-cols-3 gap-x-3">
          <N label="Low" suffix="mo" get={(p) => p.income.bonusLowMonths} set={(d, v) => (d.income.bonusLowMonths = v)} max={60} />
          <N label="Typical" suffix="mo" get={(p) => p.income.bonusBaseMonths} set={(d, v) => (d.income.bonusBaseMonths = v)} max={60} />
          <N label="High" suffix="mo" get={(p) => p.income.bonusHighMonths} set={(d, v) => (d.income.bonusHighMonths = v)} max={60} />
        </div>
      </Group>
      <Group title="Other income" note="Side work, royalties, anything outside salary. Rent and dividends are picked up in later steps.">
        <N tally="income.secondary" tallyHint="e.g. Freelance work" label="Amount per year" money get={(p) => p.income.secondaryAnnual} set={(d, v) => (d.income.secondaryAnnual = v)} />
      </Group>
    </div>
  );
}

function StepSpending() {
  const { plan, update } = useApp();
  const ex = plan.expenses;
  const monthly = ex.baseMonthly + ex.discretionaryMonthly;
  return (
    <div>
      <Group title="Spending today, per month" note="Leave out the mortgage and savings. Both are handled separately.">
        <div>
          <N tally="expenses.base" tallyHint="e.g. Groceries" label="Essentials" money get={(p) => p.expenses.baseMonthly} set={(d, v) => (d.expenses.baseMonthly = v)} hint="Food, bills, transport, insurance" />
          <N tally="expenses.discretionary" tallyHint="e.g. Dining out" label="Discretionary" money get={(p) => p.expenses.discretionaryMonthly} set={(d, v) => (d.expenses.discretionaryMonthly = v)} hint="Travel, dining, hobbies" />
        </div>
        <Row label="Total">
          <Money v={monthly} /> / mo
        </Row>
      </Group>
      <Group title="Spending in retirement" note="Many people spend less once work costs and dependants drop away. Some spend more on travel and healthcare.">
        <Slider label="Share of today’s spending" value={ex.retirementMultiplier} min={40} max={150} step={5} onChange={(v) => update((d) => void ((d.expenses.retirementMode = 'multiplier'), (d.expenses.retirementMultiplier = v)))} format={(v) => `${v}%`} />
        <Row label="Retirement budget" hint="In today’s dollars">
          <Money v={(monthly * ex.retirementMultiplier) / 100} /> / mo
        </Row>
      </Group>
    </div>
  );
}

function StepLiquid() {
  const { plan, update } = useApp();
  const l = plan.liquid;
  const total = l.cash.balance + l.domEq.balance + l.forEq.balance * l.forEq.fxRate + l.bonds.balance + l.alt.balance * (1 - l.alt.haircut / 100);
  return (
    <div>
      <Group title="What you hold today" note="Several accounts? Tap Add up and list each one. The total fills in for you, and the list is saved so you can update one line later.">
        <N tally="liquid.cash" tallyHint="e.g. Savings account" label={BUCKET_LABEL.cash} money get={(p) => p.liquid.cash.balance} set={(d, v) => (d.liquid.cash.balance = v)} />
        <N tally="liquid.domEq" tallyHint="e.g. Brokerage A" label={BUCKET_LABEL.domEq} money get={(p) => p.liquid.domEq.balance} set={(d, v) => (d.liquid.domEq.balance = v)} hint={`Shares and funds in ${plan.baseCurrency}`} />
        <N tally="liquid.bonds" tallyHint="e.g. Bond fund" label={BUCKET_LABEL.bonds} money get={(p) => p.liquid.bonds.balance} set={(d, v) => (d.liquid.bonds.balance = v)} />
      </Group>
      <Group title="Foreign equities" note="Enter the balance in the foreign currency. The app converts it and models the exchange-rate risk.">
        <N tally="liquid.forEq" tallyHint="e.g. Brokerage A" label={`Balance in ${l.forEq.currency || 'foreign currency'}`} get={(p) => p.liquid.forEq.balance} set={(d, v) => (d.liquid.forEq.balance = v)} />
        <Grid2>
          <TextField label="Currency" value={l.forEq.currency} maxLength={3} onChange={(v) => update((d) => void (d.liquid.forEq.currency = v.toUpperCase().replace(/[^A-Z]/g, '')))} />
          <N label={`${plan.baseCurrency} per 1 ${l.forEq.currency || 'unit'}`} get={(p) => p.liquid.forEq.fxRate} set={(d, v) => (d.liquid.forEq.fxRate = v)} min={0.0001} />
        </Grid2>
      </Group>
      <Group title="High-volatility assets" note="Crypto and other alternatives. The haircut is how much of the quoted value you choose not to count.">
        <N tally="liquid.alt" tallyHint="e.g. Exchange wallet" label={BUCKET_LABEL.alt} money get={(p) => p.liquid.alt.balance} set={(d, v) => (d.liquid.alt.balance = v)} />
        <Slider label="Valuation haircut" value={l.alt.haircut} min={0} max={90} step={5} onChange={(v) => update((d) => void (d.liquid.alt.haircut = v))} format={(v) => `${v}%`} />
      </Group>
      <Group title="Total">
        <Row label="Liquid assets counted">
          <Money v={total} />
        </Row>
      </Group>
    </div>
  );
}

function StepStatutory() {
  const { plan, update } = useApp();
  const st = plan.statutory;
  return (
    <div>
      <Group title="Statutory retirement accounts">
        <Toggle label="I have CPF-style accounts" checked={st.enabled} onChange={(v) => update((d) => void (d.statutory.enabled = v))} hint="Mandatory savings with fixed interest that stay locked until a set age." />
      </Group>
      {st.enabled ? (
        <>
          <Group title="Balances today" note="From your latest statement.">
            <N label="Ordinary account" money get={(p) => p.statutory.oa} set={(d, v) => (d.statutory.oa = v)} />
            <N label="Special account" money get={(p) => p.statutory.sa} set={(d, v) => (d.statutory.sa = v)} />
            <N label="Healthcare account" money get={(p) => p.statutory.ma} set={(d, v) => (d.statutory.ma = v)} />
            {plan.profile.currentAge >= st.unlockAge && <N label="Retirement account" money get={(p) => p.statutory.ra} set={(d, v) => (d.statutory.ra = v)} />}
          </Group>
          <Group title="Rules in use" note="Standard defaults. Change any of them later under Plan.">
            <Row label="Interest" hint="Ordinary / special / healthcare">
              {st.oaRate}% / {st.saRate}% / {st.maRate}%
            </Row>
            <Row label="Contributions" hint="Employee + employer">
              {st.employeeRate}% + {st.employerRate}%
            </Row>
            <Row label="Unlock age">{st.unlockAge}</Row>
            <Row label="Lifetime payout from">{st.payoutAge}</Row>
          </Group>
        </>
      ) : (
        <div className="mt-4">
          <Note>Skipped. Salary is treated as fully yours and there is no locked balance or unlock age.</Note>
        </div>
      )}
    </div>
  );
}

function StepProperty() {
  const { plan, update, startYear } = useApp();
  const pr = plan.property;
  return (
    <div>
      <Group title="Property">
        <Toggle label="I own a property" checked={pr.enabled} onChange={(v) => update((d) => void (d.property.enabled = v))} hint="Its equity counts in headline net worth but is not spendable until sold." />
      </Group>
      {pr.enabled ? (
        <>
          <Group title="Value and loan">
            <Grid2>
              <N label="Market value today" money get={(p) => p.property.marketValue} set={(d, v) => (d.property.marketValue = v)} />
              <N label="Purchase cost" money get={(p) => p.property.purchaseCost} set={(d, v) => (d.property.purchaseCost = v)} />
              <N label="Mortgage balance" money get={(p) => p.property.mortgageBalance} set={(d, v) => (d.property.mortgageBalance = v)} />
              <N label="Interest rate" pct get={(p) => p.property.mortgageRate} set={(d, v) => (d.property.mortgageRate = v)} min={0} />
              <N label="Years remaining" suffix="yrs" get={(p) => p.property.mortgageYearsLeft} set={(d, v) => (d.property.mortgageYearsLeft = v)} max={40} />
            </Grid2>
            {plan.statutory.enabled && <Slider label="Instalment paid from ordinary account" value={pr.oaSharePct} min={0} max={100} step={5} onChange={(v) => update((d) => void (d.property.oaSharePct = v))} format={(v) => `${v}%`} />}
            {pr.mortgageBalance > 0 && (
              <Row label="Monthly instalment">
                <Money v={monthlyInstalment(plan)} />
              </Row>
            )}
          </Group>
          <Group title="Rental" note="Leave rent at zero if you live in it.">
            <Grid2>
              <N label="Monthly rent" money get={(p) => p.property.monthlyRent} set={(d, v) => (d.property.monthlyRent = v)} />
              <N label="Property tax, yearly" money get={(p) => p.property.propertyTaxAnnual} set={(d, v) => (d.property.propertyTaxAnnual = v)} />
              <N label="Upkeep, monthly" money get={(p) => p.property.maintenanceMonthly} set={(d, v) => (d.property.maintenanceMonthly = v)} />
            </Grid2>
            {pr.monthlyRent > 0 && (
              <TextField label="Current tenancy ends" type="month" value={pr.tenancyEnd} onChange={(v) => update((d) => void (d.property.tenancyEnd = /^\d{4}-\d{2}$/.test(v) ? v : d.property.tenancyEnd))} />
            )}
          </Group>
          {plan.statutory.enabled && (
            <Group title="Statutory funds used for this property" note="On a sale this amount, plus interest, goes back into your locked account before you see any cash.">
              <Grid2>
                <N label="Principal used" money get={(p) => p.property.cpfPrincipalUsed} set={(d, v) => (d.property.cpfPrincipalUsed = v)} />
                <N label="Accrued interest" money get={(p) => p.property.cpfAccruedInterest} set={(d, v) => (d.property.cpfAccruedInterest = v)} />
              </Grid2>
            </Group>
          )}
          <Group title="Plan">
            <Toggle label="I plan to sell it" checked={pr.sell} onChange={(v) => update((d) => void (d.property.sell = v))} />
            {pr.sell && <Slider label="Sale year" value={Math.max(startYear, pr.sellYear)} min={startYear} max={startYear + 40} onChange={(v) => update((d) => void (d.property.sellYear = v))} hint="A sale is never modelled before the tenancy ends." />}
          </Group>
        </>
      ) : (
        <div className="mt-4">
          <Note>Skipped. Add one later under Plan.</Note>
        </div>
      )}
    </div>
  );
}

function StepTax() {
  const { plan, update } = useApp();
  const { tax } = plan;
  return (
    <div>
      <Group title="Tax-deferred retirement account" note="An SRS-style account. Top-ups cut this year’s tax and are locked until the withdrawal age. Leave both at zero if you have none.">
        <N tally="tax.deferredBalance" label="Balance today" money get={(p) => p.tax.deferredBalance} set={(d, v) => (d.tax.deferredBalance = v)} />
        <Slider
          label="Yearly top-up"
          value={Math.min(tax.deferredContribution, tax.deferredCap)}
          min={0}
          max={tax.deferredCap}
          step={Math.max(1, Math.round(tax.deferredCap / 51))}
          onChange={(v) => update((d) => void (d.tax.deferredContribution = Math.min(v, d.tax.deferredCap)))}
          format={(v) => <Money v={v} />}
          hint={`Capped at the annual limit. Withdrawable from age ${tax.deferredWithdrawAge}.`}
        />
      </Group>
      <Group title="Income tax" note={`Progressive resident brackets are preloaded, ${tax.brackets.length} bands up to ${Math.max(...tax.brackets.map((b) => b.rate))}%. Edit them later under Plan.`}>
        <N tally="tax.reliefs" tallyHint="e.g. Earned income relief" label="Yearly personal reliefs" money get={(p) => p.tax.reliefs} set={(d, v) => (d.tax.reliefs = v)} hint="Earned income, dependants and similar. A rough figure is fine." />
      </Group>
    </div>
  );
}

/** Live read-out of the draft. Right pane when unfolded, final step on the cover screen. */
function Preview() {
  const { plan, projection, bridge, startYear } = useApp();
  const adj = useAdjust();
  const { profile, statutory: st } = plan;
  const idx = projection.inflIndex;
  const accessible = projection.accessible.map((v, i) => adj(v, idx[i]));
  const headline = projection.headline.map((v, i) => adj(v, idx[i]));
  const row0 = projection.rows[0];
  const empty = headline.every((v) => Math.abs(v) < 1) && row0.salary === 0;
  const markers: ChartMarker[] = [];
  if (profile.retireAge > profile.currentAge) markers.push({ x: profile.retireAge, label: `Retire ${profile.retireAge}` });
  if (st.enabled && st.unlockAge > profile.currentAge) markers.push({ x: st.unlockAge, label: `Unlock ${st.unlockAge}` });

  if (empty) return <Note>Your projection appears here as you fill in the steps.</Note>;
  return (
    <div>
      <div className="card p-4">
        <Eyebrow>Accessible net worth today</Eyebrow>
        <div className="mt-1 text-[32px] leading-none font-semibold tracking-[-0.03em] text-fg">
          <Money v={accessible[0]} compact />
        </div>
        <div className="mt-2 text-[13px] text-fg2">
          Headline <Money v={headline[0]} compact className="font-semibold text-fg" />
        </div>
      </div>
      <div className="card mt-3 px-3 pt-3 pb-3">
        <TimeChart
          xs={projection.ages}
          height={190}
          ariaLabel="Projected headline and accessible net worth by age"
          lines={[
            { id: 'headline', label: 'Headline', color: C.headline, values: headline },
            { id: 'accessible', label: 'Accessible', color: C.accessible, values: accessible, area: true },
          ]}
          markers={markers}
          zone={bridge.status !== 'none' ? { from: bridge.fromAge, to: bridge.toAge, label: 'Bridge years' } : undefined}
          xCaption={(age) => `Age ${age} · ${startYear + age - profile.currentAge}`}
        />
      </div>
      <Group title="First read">
        <Row label="Liquidity bridge" hint={bridge.status === 'none' ? undefined : `Age ${bridge.fromAge} to ${bridge.toAge}`}>
          <Pill tone={BRIDGE_TONE[bridge.status]}>{BRIDGE_LABEL[bridge.status]}</Pill>
        </Row>
        <Row label={`Cash flow in ${startYear}`} hint={row0.netCashFlow >= 0 ? 'Saved and invested' : 'Drawn from assets'}>
          <Money v={row0.netCashFlow} compact sign />
        </Row>
        <Row label={`Accessible at ${profile.retireAge}`}>
          <Money v={accessible[Math.max(0, profile.retireAge - profile.currentAge)]} compact />
        </Row>
        <Row label={`Headline at ${profile.endAge}`}>
          <Money v={headline[headline.length - 1]} compact />
        </Row>
      </Group>
      {projection.firstShortfallAge !== null && (
        <div className="mt-3">
          <Note tone="critical">On these figures accessible money runs out at age {projection.firstShortfallAge}. Later retirement, lower spending or a property sale each change that.</Note>
        </div>
      )}
    </div>
  );
}

function StepReview({ showPreview }: { showPreview: boolean }) {
  const { projection } = useApp();
  return (
    <div>
      <Says mood={projection.firstShortfallAge !== null ? 'worried' : 'party'} size={84}>
        <span className="font-semibold">{projection.firstShortfallAge !== null ? 'We have a plan, with a gap to fix.' : 'Look at that. A plan!'}</span>{' '}
        <span className="text-fg2">This is the expected path. Tap Finish to save it, then check your odds under the Odds tab.</span>
      </Says>
      {showPreview && (
        <div className="mt-4">
          <Preview />
        </div>
      )}
      <div className="mt-4 space-y-3">
        <Note>Next: fine-tune returns, tax brackets and one-off expenses under Plan, and take an encrypted backup under Vault.</Note>
      </div>
    </div>
  );
}

interface Step {
  id: string;
  title: string;
  render: (ctx: { fromCurrent: boolean; split: boolean }) => ReactNode;
}

const STEPS: Step[] = [
  { id: 'welcome', title: 'Let’s build your plan', render: ({ fromCurrent }) => <StepWelcome fromCurrent={fromCurrent} /> },
  { id: 'you', title: 'First, about you', render: () => <StepYou /> },
  { id: 'income', title: 'What comes in', render: () => <StepIncome /> },
  { id: 'spending', title: 'What goes out', render: () => <StepSpending /> },
  { id: 'liquid', title: 'What you’ve put away', render: () => <StepLiquid /> },
  { id: 'statutory', title: 'Locked retirement savings', render: () => <StepStatutory /> },
  { id: 'property', title: 'Your property', render: () => <StepProperty /> },
  { id: 'tax', title: 'Tax and top-ups', render: () => <StepTax /> },
  { id: 'review', title: 'Your plan', render: ({ split }) => <StepReview showPreview={!split} /> },
];

/**
 * Guided setup. Works on a private draft, exposed to the step components by
 * shadowing the app context, so the same bound fields and charts used
 * elsewhere work unchanged. The stored plan is only replaced on Finish.
 */
export function SetupWizard() {
  const app = useApp();
  const split = useLayoutMode() === 'split';
  const fromCurrent = !app.plan.label.startsWith(SAMPLE_LABEL) && app.plan.label !== BLANK_LABEL;
  const [draft, setDraft] = useState<Plan>(() => (fromCurrent ? structuredClone(app.plan) : blankPlan(app.startYear)));
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  const update = useCallback((mutate: (d: Plan) => void) => {
    setDirty(true);
    setDraft((prev) => {
      const next = structuredClone(prev);
      mutate(next);
      return next;
    });
  }, []);

  const projection = useMemo(() => project(draft, app.startYear), [draft, app.startYear]);
  const bridge = useMemo(() => analyzeBridge(draft, projection), [draft, projection]);
  const scoped: AppState = { ...app, plan: draft, update, projection, bridge };

  const go = (next: number) => {
    setStep(Math.min(STEPS.length - 1, Math.max(0, next)));
    setConfirmExit(false);
    scroller.current?.scrollTo({ top: 0 });
  };
  const exit = () => {
    if (dirty && !confirmExit) setConfirmExit(true);
    else app.setWizard(false);
  };
  const finish = () => {
    app.replacePlan({ ...draft, label: CUSTOM_LABEL });
    app.setWizard(false);
    app.setTab('overview');
    app.notify('Plan saved on this device');
    app.celebrate();
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const idx0 = projection.inflIndex[0] || 1;

  const main = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <header className={`safe-top shrink-0 ${split ? 'safe-left' : 'safe-left safe-right'}`}>
        <div className="flex h-[56px] items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <Eyebrow>{step === 0 ? 'Guided setup' : `Step ${step} of ${STEPS.length - 1}`}</Eyebrow>
            <h1 className="truncate text-[19px] leading-tight font-semibold tracking-[-0.01em] text-fg">{current.title}</h1>
          </div>
          <button type="button" onClick={exit} aria-label="Exit setup" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-raised text-fg2 active:scale-90">
            <X size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
        <div className="mx-4 flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length - 1} aria-valuenow={step} aria-label="Setup progress">
          {STEPS.slice(1).map((s, i) => (
            <button key={s.id} type="button" aria-label={`Go to ${s.title}`} onClick={() => go(i + 1)} className="h-4 flex-1 py-[6px]">
              <span className={`block h-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-accent' : 'bg-raised'}`} />
            </button>
          ))}
        </div>
      </header>

      <div ref={scroller} className={`scroll-y min-h-0 flex-1 pt-3 ${split ? 'safe-left' : 'safe-left safe-right'}`}>
        <div key={current.id} className="anim-rise mx-auto max-w-[592px] px-4 pb-6">
          {confirmExit && (
            <div className="mb-3">
              <Note tone="warning">
                Leave setup? What you entered here is discarded. Your saved plan is untouched.
                <span className="mt-2 flex gap-2">
                  <Button onClick={() => setConfirmExit(false)}>Keep going</Button>
                  <Button variant="danger" onClick={() => app.setWizard(false)}>
                    Discard
                  </Button>
                </span>
              </Note>
            </div>
          )}
          {current.render({ fromCurrent, split })}
        </div>
      </div>

      <footer className={`glass-bar safe-bottom shrink-0 border-t border-line ${split ? 'safe-left' : 'safe-left safe-right'}`}>
        <div className="mx-auto max-w-[560px] px-4 pt-2.5 pb-2.5">
          {!split && step > 0 && !last && (
            <div className="mb-2 flex items-center justify-between gap-3 text-[12px] text-fg3">
              <span>
                Accessible today <Money v={projection.accessible[0] / idx0} compact className="font-semibold text-fg" />
              </span>
              <span>
                At {draft.profile.endAge} <Money v={projection.headline[projection.headline.length - 1] / (app.settings.real ? projection.inflIndex[projection.inflIndex.length - 1] : 1)} compact className="font-semibold text-fg" />
              </span>
            </div>
          )}
          <div className="flex gap-2">
            {step > 0 && (
              <Button icon={ArrowLeft} onClick={() => go(step - 1)}>
                Back
              </Button>
            )}
            {last ? (
              <Button icon={Check} variant="primary" className="flex-1" onClick={finish}>
                Finish and save
              </Button>
            ) : (
              <Button icon={step === 0 ? ShieldCheck : ArrowRight} variant="primary" className="flex-1" onClick={() => go(step + 1)}>
                {step === 0 ? 'Start' : 'Next'}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );

  return (
    <AppContext.Provider value={scoped}>
      {split ? (
        <div className="split relative z-10 h-full">
          <div className="flex min-h-0 min-w-0 flex-col">{main}</div>
          <aside className="safe-right flex min-h-0 min-w-0 flex-col" aria-label="Live projection">
            <div className="safe-top shrink-0">
              <div className="flex h-[56px] items-center px-5">
                <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-fg">Live projection</h2>
              </div>
            </div>
            <div className="scroll-y min-h-0 flex-1 px-5 pt-3 pb-8">
              <Preview />
            </div>
          </aside>
        </div>
      ) : (
        <div className="relative z-10 flex h-full flex-col">{main}</div>
      )}
    </AppContext.Provider>
  );
}
