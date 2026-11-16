import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { TallyButton, TallyPanel } from '../components/Tally';
import { newTallyLine, tallySum } from '../lib/tally';
import { Button, Grid2, Group, Money, Note, NumField, Row, Segmented, Slider, TextField, Toggle } from '../components/ui';
import { grossMonthlySalary, monthlyInstalment, tenancyEndYear } from '../engine/simulate';
import type { AssetBucket, DrawStrategy, LiquidKey, Plan, RetirementSumLock, TallyLine } from '../engine/types';
import { BUCKET_LABEL } from '../lib/colors';
import { useApp } from '../store/context';

/** Numeric field bound to one path of the plan. */
export function N({
  label,
  get,
  set,
  money,
  pct,
  suffix,
  hint,
  max,
  min,
  tally,
  tallyHint = 'e.g. Account A',
}: {
  label: string;
  get: (p: Plan) => number;
  set: (d: Plan, v: number) => void;
  money?: boolean;
  pct?: boolean;
  suffix?: string;
  hint?: ReactNode;
  max?: number;
  min?: number;
  /** Field id. When set, the number can be built from an itemised list stored with the plan. */
  tally?: string;
  /** Placeholder for the first item's label. */
  tallyHint?: string;
}) {
  const { plan, update } = useApp();
  const [open, setOpen] = useState(false);
  const lines = tally ? (plan.breakdowns[tally] ?? []) : [];
  const itemised = lines.length > 0;
  const lo = min ?? (pct ? -100 : 0);
  const hi = max ?? (pct ? 1000 : 1e12);

  const write = (next: TallyLine[]) => {
    if (!tally) return;
    update((d) => {
      if (next.length === 0) delete d.breakdowns[tally];
      else d.breakdowns[tally] = next;
      if (next.length > 0) set(d, Math.min(hi, Math.max(lo, tallySum(next))));
    });
  };
  const toggle = () => {
    // First open: carry the number already typed into the first line.
    if (!itemised && !open) write([newTallyLine(get(plan)), newTallyLine()]);
    setOpen(!open);
  };

  return (
    <>
      <NumField
        label={label}
        value={get(plan)}
        onChange={(v) => update((d) => set(d, v))}
        prefix={money ? '$' : undefined}
        suffix={pct ? '%' : suffix}
        sensitive={money}
        hint={itemised && !open ? `Total of ${lines.length} ${lines.length === 1 ? 'item' : 'items'}. Tap to edit them.` : hint}
        min={lo}
        max={hi}
        locked={itemised}
        onLockedTap={() => setOpen(true)}
        trailing={tally ? <TallyButton count={lines.length} open={open} onClick={toggle} label={label} /> : undefined}
      />
      {tally && open && itemised && (
        <TallyPanel
          lines={lines}
          onChange={write}
          money={Boolean(money)}
          unit={!money && suffix ? ` ${suffix}` : undefined}
          placeholder={tallyHint}
          onClear={() => {
            update((d) => void delete d.breakdowns[tally]);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export function EditProfile() {
  const { plan, update, startYear } = useApp();
  const p = plan.profile;
  return (
    <div>
      <Group title="Timeline">
        <Slider label="Current age" value={p.currentAge} min={18} max={80} onChange={(v) => update((d) => void ((d.profile.currentAge = v), (d.profile.endAge = Math.max(d.profile.endAge, v + 1))))} />
        <Slider label="Target retirement age" value={p.retireAge} min={Math.min(p.currentAge, 40)} max={75} onChange={(v) => update((d) => void (d.profile.retireAge = v))} format={(v) => `${v} · ${startYear + Math.max(0, v - p.currentAge)}`} />
        <Slider label="Plan to age" value={p.endAge} min={Math.max(80, p.currentAge + 1)} max={105} onChange={(v) => update((d) => void (d.profile.endAge = v))} />
      </Group>
      <Group title="Macro assumptions">
        <Grid2>
          <N label="Inflation" pct get={(x) => x.macro.inflation} set={(d, v) => (d.macro.inflation = v)} />
          <N label="Inflation volatility" pct get={(x) => x.macro.inflationVol} set={(d, v) => (d.macro.inflationVol = v)} min={0} />
        </Grid2>
        <Slider
          label="Domestic / foreign equity correlation"
          value={plan.macro.equityCorrelation}
          min={-0.5}
          max={0.95}
          step={0.05}
          onChange={(v) => update((d) => void (d.macro.equityCorrelation = v))}
          format={(v) => v.toFixed(2)}
        />
      </Group>
      <Group title="Drawdown order" note="How deficits are funded once spending exceeds income.">
        <div className="py-2">
          <Segmented<DrawStrategy>
            label="Drawdown strategy"
            value={plan.drawStrategy}
            onChange={(v) => update((d) => void (d.drawStrategy = v))}
            options={[
              { value: 'sequential', label: 'Cash, bonds, equities' },
              { value: 'proRata', label: 'Pro rata' },
            ]}
          />
        </div>
      </Group>
      <Group title="Display">
        <TextField label="Base currency code" value={plan.baseCurrency} maxLength={3} onChange={(v) => update((d) => void (d.baseCurrency = v.toUpperCase().replace(/[^A-Z]/g, '')))} />
      </Group>
    </div>
  );
}

function BucketFields({ id, children }: { id: LiquidKey; children?: ReactNode }) {
  const bucket = (p: Plan): AssetBucket => p.liquid[id];
  return (
    <Group title={BUCKET_LABEL[id]}>
      <N tally={`liquid.${id}`} tallyHint={id === 'cash' ? 'e.g. Savings account' : 'e.g. Brokerage A'} label={id === 'forEq' ? 'Balance in foreign currency' : 'Balance'} money={id !== 'forEq'} get={(p) => bucket(p).balance} set={(d, v) => (bucket(d).balance = v)} />
      <Grid2>
        <N label="Expected return" pct get={(p) => bucket(p).ret} set={(d, v) => (bucket(d).ret = v)} />
        <N label="Volatility" pct get={(p) => bucket(p).vol} set={(d, v) => (bucket(d).vol = v)} min={0} />
        <N label="Cash yield" pct get={(p) => bucket(p).yieldPct} set={(d, v) => (bucket(d).yieldPct = v)} min={0} />
        <N label="Share of savings" pct get={(p) => bucket(p).savePct} set={(d, v) => (bucket(d).savePct = v)} min={0} max={100} />
      </Grid2>
      {children}
    </Group>
  );
}

export function EditLiquid() {
  const { plan, update } = useApp();
  const l = plan.liquid;
  const saveTotal = l.cash.savePct + l.domEq.savePct + l.forEq.savePct + l.bonds.savePct + l.alt.savePct;
  const keep = 1 - l.alt.haircut / 100;
  return (
    <div>
      <Note tone={Math.abs(saveTotal - 100) < 0.01 || saveTotal === 0 ? 'neutral' : 'warning'}>
        Savings shares add up to {saveTotal}%. {saveTotal === 0 ? 'All surplus goes to cash.' : Math.abs(saveTotal - 100) < 0.01 ? 'Each year’s surplus is split in these proportions.' : 'They are scaled to 100% when applied.'} Expected returns are
        compound annual rates.
      </Note>
      <BucketFields id="cash" />
      <BucketFields id="domEq" />
      <BucketFields id="forEq">
        <Grid2>
          <TextField label="Foreign currency" value={l.forEq.currency} maxLength={3} onChange={(v) => update((d) => void (d.liquid.forEq.currency = v.toUpperCase().replace(/[^A-Z]/g, '')))} />
          <N label={`${plan.baseCurrency} per 1 ${l.forEq.currency || 'unit'}`} get={(p) => p.liquid.forEq.fxRate} set={(d, v) => (d.liquid.forEq.fxRate = v)} min={0.0001} />
          <N label="FX drift" pct get={(p) => p.liquid.forEq.fxDrift} set={(d, v) => (d.liquid.forEq.fxDrift = v)} hint="Foreign currency vs base, per year" />
          <N label="FX volatility" pct get={(p) => p.liquid.forEq.fxVol} set={(d, v) => (d.liquid.forEq.fxVol = v)} min={0} />
        </Grid2>
        <Row label={`Value in ${plan.baseCurrency}`}>
          <Money v={l.forEq.balance * l.forEq.fxRate} />
        </Row>
      </BucketFields>
      <BucketFields id="bonds" />
      <BucketFields id="alt">
        <Slider label="Valuation haircut" value={l.alt.haircut} min={0} max={90} step={5} onChange={(v) => update((d) => void (d.liquid.alt.haircut = v))} format={(v) => `${v}%`} hint="Applied to every valuation and to what a sale realises." />
        <Row label="Counted in net worth" hint="Confidence band: haircut value to full mark">
          <Money v={l.alt.balance * keep} compact /> – <Money v={l.alt.balance} compact />
        </Row>
      </BucketFields>
    </div>
  );
}

export function EditStatutory() {
  const { plan, update } = useApp();
  const st = plan.statutory;
  const shares = st.oaShare + st.saShare + st.maShare;
  return (
    <div>
      <Group title="Module">
        <Toggle label="Model statutory retirement accounts" checked={st.enabled} onChange={(v) => update((d) => void (d.statutory.enabled = v))} hint="CPF-style locked accounts with their own interest, contribution and withdrawal rules." />
      </Group>
      {st.enabled && (
        <>
          <Group title="Balances">
            <Grid2>
              <N tally="statutory.oa" label="Ordinary account" money get={(p) => p.statutory.oa} set={(d, v) => (d.statutory.oa = v)} />
              <N label="Special account" money get={(p) => p.statutory.sa} set={(d, v) => (d.statutory.sa = v)} />
              <N label="Healthcare account" money get={(p) => p.statutory.ma} set={(d, v) => (d.statutory.ma = v)} />
              <N label="Retirement account" money get={(p) => p.statutory.ra} set={(d, v) => (d.statutory.ra = v)} hint="After the unlock age" />
            </Grid2>
          </Group>
          <Group title="Interest rates">
            <Grid2>
              <N label="Ordinary" pct get={(p) => p.statutory.oaRate} set={(d, v) => (d.statutory.oaRate = v)} min={0} />
              <N label="Special / retirement" pct get={(p) => p.statutory.saRate} set={(d, v) => (d.statutory.saRate = v)} min={0} />
              <N label="Healthcare" pct get={(p) => p.statutory.maRate} set={(d, v) => (d.statutory.maRate = v)} min={0} />
            </Grid2>
          </Group>
          <Group title="Healthcare ceiling" note="Above the ceiling, contributions and interest overflow to the special or retirement account, then to the ordinary account.">
            <Grid2>
              <N label="Ceiling today" money get={(p) => p.statutory.maCap} set={(d, v) => (d.statutory.maCap = v)} />
              <N label="Ceiling growth" pct get={(p) => p.statutory.maCapGrowth} set={(d, v) => (d.statutory.maCapGrowth = v)} />
            </Grid2>
          </Group>
          <Group title="Withdrawal lock and annuity">
            <Slider label="Unlock age" value={st.unlockAge} min={50} max={70} onChange={(v) => update((d) => void (d.statutory.unlockAge = v))} />
            <Grid2>
              <N label="Full retirement sum today" money get={(p) => p.statutory.frs} set={(d, v) => (d.statutory.frs = v)} />
              <N label="Sum growth" pct get={(p) => p.statutory.frsGrowth} set={(d, v) => (d.statutory.frsGrowth = v)} />
            </Grid2>
            <div className="py-2">
              <div className="mb-1.5 text-[13px] text-fg2">Lock-in at unlock age</div>
              <Segmented<RetirementSumLock>
                label="Retirement sum lock-in"
                value={st.lockIn}
                onChange={(v) => update((d) => void (d.statutory.lockIn = v))}
                options={[
                  { value: 'FRS', label: 'Full sum' },
                  { value: 'ERS', label: `Enhanced · ${st.ersMultiple}×` },
                ]}
              />
            </div>
            <N label="Enhanced sum multiple" suffix="× full" get={(p) => p.statutory.ersMultiple} set={(d, v) => (d.statutory.ersMultiple = v)} min={1} max={10} />
            <Slider label="Lifetime payout starts" value={st.payoutAge} min={Math.max(55, st.unlockAge)} max={75} onChange={(v) => update((d) => void (d.statutory.payoutAge = v))} format={(v) => `Age ${v}`} />
            <N label="Annual payout rate" pct get={(p) => p.statutory.payoutRate} set={(d, v) => (d.statutory.payoutRate = v)} min={0} max={30} hint="Share of the retirement account paid each year, for life" />
          </Group>
          <Group title="Contributions" note={`Allocation shares add up to ${shares}%. They are scaled to 100% of the total contribution.`}>
            <Grid2>
              <N label="Employee rate" pct get={(p) => p.statutory.employeeRate} set={(d, v) => (d.statutory.employeeRate = v)} min={0} max={99} />
              <N label="Employer rate" pct get={(p) => p.statutory.employerRate} set={(d, v) => (d.statutory.employerRate = v)} min={0} max={100} />
              <N label="To ordinary" pct get={(p) => p.statutory.oaShare} set={(d, v) => (d.statutory.oaShare = v)} min={0} max={100} />
              <N label="To special" pct get={(p) => p.statutory.saShare} set={(d, v) => (d.statutory.saShare = v)} min={0} max={100} />
              <N label="To healthcare" pct get={(p) => p.statutory.maShare} set={(d, v) => (d.statutory.maShare = v)} min={0} max={100} />
            </Grid2>
            <Grid2>
              <N label="Monthly wage ceiling" money get={(p) => p.statutory.wageCeilingMonthly} set={(d, v) => (d.statutory.wageCeilingMonthly = v)} />
              <N label="Annual wage ceiling" money get={(p) => p.statutory.wageCeilingAnnual} set={(d, v) => (d.statutory.wageCeilingAnnual = v)} />
            </Grid2>
          </Group>
        </>
      )}
    </div>
  );
}

export function EditProperty() {
  const { plan, update, startYear } = useApp();
  const pr = plan.property;
  const lockYear = Math.max(tenancyEndYear(plan), startYear);
  return (
    <div>
      <Group title="Module">
        <Toggle label="Model a property" checked={pr.enabled} onChange={(v) => update((d) => void (d.property.enabled = v))} hint="Equity counts toward headline net worth and stays out of accessible net worth until sold." />
      </Group>
      {pr.enabled && (
        <>
          <Group title="Value">
            <Grid2>
              <N label="Purchase cost" money get={(p) => p.property.purchaseCost} set={(d, v) => (d.property.purchaseCost = v)} />
              <N label="Market value today" money get={(p) => p.property.marketValue} set={(d, v) => (d.property.marketValue = v)} />
              <N label="Appreciation" pct get={(p) => p.property.appreciation} set={(d, v) => (d.property.appreciation = v)} />
              <N label="Price volatility" pct get={(p) => p.property.vol} set={(d, v) => (d.property.vol = v)} min={0} />
            </Grid2>
          </Group>
          <Group title="Mortgage">
            <Grid2>
              <N label="Outstanding balance" money get={(p) => p.property.mortgageBalance} set={(d, v) => (d.property.mortgageBalance = v)} />
              <N label="Interest rate" pct get={(p) => p.property.mortgageRate} set={(d, v) => (d.property.mortgageRate = v)} min={0} />
              <N label="Years remaining" suffix="yrs" get={(p) => p.property.mortgageYearsLeft} set={(d, v) => (d.property.mortgageYearsLeft = v)} max={40} />
            </Grid2>
            <Slider label="Paid from ordinary account" value={pr.oaSharePct} min={0} max={100} step={5} onChange={(v) => update((d) => void (d.property.oaSharePct = v))} format={(v) => `${v}% OA · ${100 - v}% cash`} />
            <Row label="Monthly instalment">
              <Money v={monthlyInstalment(plan)} />
            </Row>
          </Group>
          <Group title="Rent and running costs">
            <Grid2>
              <N label="Gross monthly rent" money get={(p) => p.property.monthlyRent} set={(d, v) => (d.property.monthlyRent = v)} />
              <N label="Rent growth" pct get={(p) => p.property.rentGrowth} set={(d, v) => (d.property.rentGrowth = v)} hint="After the lock-in" />
              <N label="Property tax, annual" money get={(p) => p.property.propertyTaxAnnual} set={(d, v) => (d.property.propertyTaxAnnual = v)} />
              <N label="Maintenance, monthly" money get={(p) => p.property.maintenanceMonthly} set={(d, v) => (d.property.maintenanceMonthly = v)} />
              <N label="Vacancy buffer" pct get={(p) => p.property.vacancyPct} set={(d, v) => (d.property.vacancyPct = v)} min={0} max={100} hint="After the lock-in" />
              <N label="Agent fee" pct get={(p) => p.property.agentFeePct} set={(d, v) => (d.property.agentFeePct = v)} min={0} max={100} hint="Of gross rent" />
            </Grid2>
            <TextField label="Tenancy lock-in ends" type="month" value={pr.tenancyEnd} onChange={(v) => update((d) => void (d.property.tenancyEnd = /^\d{4}-\d{2}$/.test(v) ? v : d.property.tenancyEnd))} />
          </Group>
          <Group title="Statutory funds used for housing" note="On sale, principal plus accrued interest is refunded to the locked account before any cash reaches you.">
            <Grid2>
              <N label="Principal used so far" money get={(p) => p.property.cpfPrincipalUsed} set={(d, v) => (d.property.cpfPrincipalUsed = v)} />
              <N label="Accrued interest so far" money get={(p) => p.property.cpfAccruedInterest} set={(d, v) => (d.property.cpfAccruedInterest = v)} />
              <N label="Accrual rate" pct get={(p) => p.property.accruedRate} set={(d, v) => (d.property.accruedRate = v)} min={0} />
            </Grid2>
          </Group>
          <Group title="Sale">
            <N label="Selling costs" pct get={(p) => p.property.sellingCostPct} set={(d, v) => (d.property.sellingCostPct = v)} min={0} max={100} hint="Agent, legal and taxes, as a share of price" />
            <Toggle label="Plan to sell" checked={pr.sell} onChange={(v) => update((d) => void (d.property.sell = v))} />
            {pr.sell && (
              <Slider
                label="Sale year"
                value={Math.max(lockYear, pr.sellYear)}
                min={lockYear}
                max={startYear + 40}
                onChange={(v) => update((d) => void (d.property.sellYear = v))}
                format={(v) => `${v} · age ${v - startYear + plan.profile.currentAge}`}
                hint={`Earliest possible sale is ${lockYear}, when the lock-in ends.`}
              />
            )}
          </Group>
        </>
      )}
    </div>
  );
}

export function EditIncome() {
  const { plan, update } = useApp();
  const inc = plan.income;
  const gross = grossMonthlySalary(plan);
  return (
    <div>
      <Group title="Salary">
        <N label={`Monthly base salary (${inc.salaryIsGross ? 'gross' : 'take-home'})`} money get={(p) => p.income.salaryMonthly} set={(d, v) => (d.income.salaryMonthly = v)} />
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
        {!inc.salaryIsGross && (
          <Row label="Implied gross salary" hint="Take-home grossed up for the employee statutory contribution. Income tax is still computed separately.">
            <Money v={gross} />
          </Row>
        )}
        <N label="Salary growth" pct get={(p) => p.income.salaryGrowth} set={(d, v) => (d.income.salaryGrowth = v)} />
      </Group>
      <Group title="Variable annual bonus" note="Months of gross salary. The deterministic view uses the selected band. Monte Carlo draws between low and high each year.">
        <div className="grid grid-cols-3 gap-x-3">
          <N label="Low" suffix="mo" get={(p) => p.income.bonusLowMonths} set={(d, v) => (d.income.bonusLowMonths = v)} max={60} />
          <N label="Base" suffix="mo" get={(p) => p.income.bonusBaseMonths} set={(d, v) => (d.income.bonusBaseMonths = v)} max={60} />
          <N label="High" suffix="mo" get={(p) => p.income.bonusHighMonths} set={(d, v) => (d.income.bonusHighMonths = v)} max={60} />
        </div>
        <div className="py-2">
          <Segmented
            label="Bonus scenario"
            value={inc.bonusScenario}
            onChange={(v) => update((d) => void (d.income.bonusScenario = v))}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'base', label: 'Base' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
        <Row label="Bonus this year">
          <Money v={gross * (inc.bonusScenario === 'low' ? inc.bonusLowMonths : inc.bonusScenario === 'high' ? inc.bonusHighMonths : inc.bonusBaseMonths)} />
        </Row>
      </Group>
      <Group title="Secondary / royalty income" note="Rental income comes from the property module. Dividends and coupons come from each bucket’s cash yield.">
        <N tally="income.secondary" tallyHint="e.g. Freelance work" label="Annual amount today" money get={(p) => p.income.secondaryAnnual} set={(d, v) => (d.income.secondaryAnnual = v)} />
        <Grid2>
          <N label="Decay per year" pct get={(p) => p.income.secondaryDecay} set={(d, v) => (d.income.secondaryDecay = v)} max={100} />
          <N label="Final year" get={(p) => p.income.secondaryEndYear} set={(d, v) => (d.income.secondaryEndYear = Math.round(v))} max={2200} hint="0 = no end" />
        </Grid2>
      </Group>
    </div>
  );
}

export function EditTax() {
  const { plan, update } = useApp();
  const { tax } = plan;
  return (
    <div>
      <Group title="Reliefs">
        <N tally="tax.reliefs" tallyHint="e.g. Earned income relief" label="Annual reliefs" money get={(p) => p.tax.reliefs} set={(d, v) => (d.tax.reliefs = v)} hint="Deducted from assessable income, on top of statutory contributions and tax-deferred top-ups" />
      </Group>
      <Group title="Tax-deferred account" note="An SRS-style bucket. Contributions are deductible, growth is untaxed, withdrawals are partly taxable.">
        <Grid2>
          <N label="Annual cap" money get={(p) => p.tax.deferredCap} set={(d, v) => (d.tax.deferredCap = v)} />
          <N label="Annual contribution" money get={(p) => p.tax.deferredContribution} set={(d, v) => (d.tax.deferredContribution = v)} max={tax.deferredCap} />
          <N tally="tax.deferredBalance" label="Balance today" money get={(p) => p.tax.deferredBalance} set={(d, v) => (d.tax.deferredBalance = v)} />
          <N label="Expected return" pct get={(p) => p.tax.deferredReturn} set={(d, v) => (d.tax.deferredReturn = v)} />
          <N label="Volatility" pct get={(p) => p.tax.deferredVol} set={(d, v) => (d.tax.deferredVol = v)} min={0} />
          <N label="Withdraw from age" get={(p) => p.tax.deferredWithdrawAge} set={(d, v) => (d.tax.deferredWithdrawAge = Math.round(v))} max={100} />
          <N label="Spread over" suffix="yrs" get={(p) => p.tax.deferredWithdrawYears} set={(d, v) => (d.tax.deferredWithdrawYears = Math.round(v))} min={1} max={40} />
          <N label="Taxable share" pct get={(p) => p.tax.deferredTaxablePct} set={(d, v) => (d.tax.deferredTaxablePct = v)} min={0} max={100} />
        </Grid2>
      </Group>
      <Group title="Progressive brackets" note="Rate applied to chargeable income up to each threshold. Leave the last threshold empty for no upper limit.">
        {tax.brackets.map((b, i) => (
          <div key={i} className="grid grid-cols-[1fr_88px_44px] items-end gap-x-2">
            <NumField
              label={i === 0 ? 'Up to' : ''}
              prefix="$"
              value={b.upTo ?? NaN}
              onChange={(v) => update((d) => void (d.tax.brackets[i].upTo = v > 0 ? v : null))}
              hint={b.upTo === null ? 'No upper limit' : undefined}
            />
            <NumField label={i === 0 ? 'Rate' : ''} suffix="%" value={b.rate} max={100} onChange={(v) => update((d) => void (d.tax.brackets[i].rate = v))} />
            <button type="button" aria-label={`Remove bracket ${i + 1}`} disabled={tax.brackets.length <= 1} onClick={() => update((d) => void d.tax.brackets.splice(i, 1))} className="mb-1.5 grid h-[46px] w-11 place-items-center rounded-2xl text-fg3 disabled:opacity-30">
              <Trash2 size={17} aria-hidden />
            </button>
          </div>
        ))}
        <div className="py-2">
          <Button
            icon={Plus}
            onClick={() =>
              update((d) => {
                const last = d.tax.brackets[d.tax.brackets.length - 1];
                const prev = d.tax.brackets[d.tax.brackets.length - 2];
                if (last && last.upTo === null) last.upTo = (prev?.upTo ?? 0) + 100_000;
                d.tax.brackets.push({ upTo: null, rate: last?.rate ?? 0 });
              })
            }
          >
            Add bracket
          </Button>
        </div>
      </Group>
    </div>
  );
}

export function EditExpenses() {
  const { plan, update, startYear } = useApp();
  const ex = plan.expenses;
  const monthly = ex.baseMonthly + ex.discretionaryMonthly;
  return (
    <div>
      <Group title="Pre-retirement, per month" note="Today’s dollars. Grows with inflation. The mortgage is modelled separately under Property.">
        <div>
          <N tally="expenses.base" tallyHint="e.g. Groceries" label="Base living" money get={(p) => p.expenses.baseMonthly} set={(d, v) => (d.expenses.baseMonthly = v)} />
          <N tally="expenses.discretionary" tallyHint="e.g. Dining out" label="Discretionary" money get={(p) => p.expenses.discretionaryMonthly} set={(d, v) => (d.expenses.discretionaryMonthly = v)} />
        </div>
        <Row label="Total">
          <Money v={monthly} /> / mo
        </Row>
      </Group>
      <Group title="Retirement / coast phase">
        <div className="py-2">
          <Segmented
            label="Retirement spending basis"
            value={ex.retirementMode}
            onChange={(v) => update((d) => void (d.expenses.retirementMode = v))}
            options={[
              { value: 'multiplier', label: 'Multiplier' },
              { value: 'custom', label: 'Custom budget' },
            ]}
          />
        </div>
        {ex.retirementMode === 'multiplier' ? (
          <Slider label="Share of pre-retirement spending" value={ex.retirementMultiplier} min={40} max={150} step={5} onChange={(v) => update((d) => void (d.expenses.retirementMultiplier = v))} format={(v) => `${v}%`} />
        ) : (
          <N tally="expenses.retirementCustom" tallyHint="e.g. Groceries" label="Monthly budget in retirement" money get={(p) => p.expenses.retirementCustomMonthly} set={(d, v) => (d.expenses.retirementCustomMonthly = v)} hint="Today’s dollars. Leave out work, mortgage and dependant costs. Add travel and healthcare." />
        )}
        <Row label="Retirement spending">
          <Money v={ex.retirementMode === 'multiplier' ? (monthly * ex.retirementMultiplier) / 100 : ex.retirementCustomMonthly} /> / mo
        </Row>
        <N label="Extra retirement inflation" suffix="pp" get={(p) => p.expenses.retirementExtraInflation} set={(d, v) => (d.expenses.retirementExtraInflation = v)} min={-5} max={10} hint="Above general inflation, for travel and healthcare" />
      </Group>
      <Group title="One-off and periodic expenses">
        {ex.oneOffs.length === 0 && <div className="py-2 text-[13px] text-fg3">None yet.</div>}
        {ex.oneOffs.map((o, i) => (
          <div key={o.id} className="border-b border-line py-2 last:border-b-0">
            <div className="grid grid-cols-[1fr_44px] items-end gap-x-2">
              <TextField label="Label" value={o.label} maxLength={60} onChange={(v) => update((d) => void (d.expenses.oneOffs[i].label = v))} />
              <button type="button" aria-label={`Remove ${o.label}`} onClick={() => update((d) => void d.expenses.oneOffs.splice(i, 1))} className="mb-1.5 grid h-[46px] w-11 place-items-center rounded-2xl text-fg3">
                <Trash2 size={17} aria-hidden />
              </button>
            </div>
            <Grid2>
              <NumField label="Amount" prefix="$" sensitive value={o.amount} onChange={(v) => update((d) => void (d.expenses.oneOffs[i].amount = v))} />
              <NumField label="First year" value={o.year} min={startYear} max={2200} onChange={(v) => update((d) => void (d.expenses.oneOffs[i].year = Math.round(v)))} />
              <NumField label="Repeat every" suffix="yrs" value={o.everyYears} max={50} hint="0 = once" onChange={(v) => update((d) => void (d.expenses.oneOffs[i].everyYears = Math.round(v)))} />
              <NumField label="Last year" value={o.untilYear} max={2200} hint="0 = no end" onChange={(v) => update((d) => void (d.expenses.oneOffs[i].untilYear = Math.round(v)))} />
            </Grid2>
            <Toggle label="Grow with inflation" checked={o.inflate} onChange={(v) => update((d) => void (d.expenses.oneOffs[i].inflate = v))} />
          </div>
        ))}
        <div className="py-2">
          <Button
            icon={Plus}
            onClick={() =>
              update((d) => {
                d.expenses.oneOffs.push({ id: `item-${Date.now().toString(36)}`, label: 'New expense', year: startYear + 1, amount: 10_000, everyYears: 0, untilYear: 0, inflate: true });
              })
            }
          >
            Add expense
          </Button>
        </div>
      </Group>
    </div>
  );
}
