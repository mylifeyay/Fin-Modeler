import { Briefcase, Building2, Coins, Landmark, Receipt, User, Wallet, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, Chevron, Money, Note } from '../components/ui';
import { BLANK_LABEL, SAMPLE_LABEL } from '../engine/defaults';
import { useApp, type DetailId } from '../store/context';
import { useDetailNav } from '../store/useDetailNav';

function Section({ id, icon: Icon, title, summary }: { id: DetailId; icon: LucideIcon; title: string; summary: ReactNode }) {
  const nav = useDetailNav();
  return (
    <Card onClick={() => nav.open(id)} selected={nav.split && nav.active === id} className="!p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-raised text-fg2">
          <Icon size={19} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-fg">{title}</span>
          <span className="mt-0.5 block truncate text-[13px] text-fg3">{summary}</span>
        </span>
        <Chevron />
      </div>
    </Card>
  );
}

export function PlanView() {
  const { plan } = useApp();
  const { profile, liquid: l, statutory: st, property: pr, income, tax, expenses: ex } = plan;
  const liquid = l.cash.balance + l.domEq.balance + l.forEq.balance * l.forEq.fxRate + l.bonds.balance + l.alt.balance * (1 - l.alt.haircut / 100);
  return (
    <div className="anim-rise space-y-3">
      {plan.label.startsWith(SAMPLE_LABEL) && (
        <Note>
          You are looking at the <strong className="text-fg">Sample Preset</strong>: generic round numbers for exploring. Replace them with your own, or start from blank under Vault.
        </Note>
      )}
      {plan.label === BLANK_LABEL && <Note>Blank plan. Fill in each section. Everything you type stays on this device.</Note>}
      <Section id="edit-profile" icon={User} title="Profile & assumptions" summary={`Age ${profile.currentAge} · retire ${profile.retireAge} · plan to ${profile.endAge} · ${plan.macro.inflation}% inflation`} />
      <Section
        id="edit-liquid"
        icon={Coins}
        title="Liquid assets"
        summary={
          <>
            <Money v={liquid} compact /> across 5 buckets
          </>
        }
      />
      <Section
        id="edit-statutory"
        icon={Landmark}
        title="Statutory retirement accounts"
        summary={
          st.enabled ? (
            <>
              <Money v={st.oa + st.sa + st.ma + st.ra} compact /> · unlock {st.unlockAge} · payout {st.payoutAge}
            </>
          ) : (
            'Off'
          )
        }
      />
      <Section
        id="edit-property"
        icon={Building2}
        title="Property"
        summary={
          pr.enabled ? (
            <>
              <Money v={pr.marketValue} compact /> value · <Money v={pr.mortgageBalance} compact /> mortgage · {pr.sell ? `sell ${pr.sellYear}` : 'hold'}
            </>
          ) : (
            'Off'
          )
        }
      />
      <Section
        id="edit-income"
        icon={Briefcase}
        title="Income"
        summary={
          <>
            <Money v={income.salaryMonthly} compact /> / mo {income.salaryIsGross ? 'gross' : 'take-home'} · bonus {income.bonusLowMonths}–{income.bonusHighMonths} mo
          </>
        }
      />
      <Section
        id="edit-tax"
        icon={Receipt}
        title="Tax & tax-deferred top-ups"
        summary={
          <>
            {tax.brackets.length} brackets · <Money v={Math.min(tax.deferredContribution, tax.deferredCap)} compact /> / yr deferred
          </>
        }
      />
      <Section
        id="edit-expenses"
        icon={Wallet}
        title="Expenses"
        summary={
          <>
            <Money v={ex.baseMonthly + ex.discretionaryMonthly} compact /> / mo · retirement {ex.retirementMode === 'multiplier' ? `${ex.retirementMultiplier}%` : 'custom'} · {ex.oneOffs.length} one-offs
          </>
        }
      />
    </div>
  );
}
