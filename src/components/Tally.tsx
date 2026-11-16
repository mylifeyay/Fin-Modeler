import { ListPlus, Minus, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TallyLine } from '../engine/types';
import { newTallyLine, tallySum } from '../lib/tally';
import { Money, NumField } from './ui';

/** The pill at the end of a field that opens its itemised list. */
export function TallyButton({ count, open, onClick, label }: { count: number; open: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={count > 0 ? `${label}: ${count} items. ${open ? 'Hide' : 'Edit'} the list.` : `Add up several amounts for ${label}`}
      className={`flex h-[46px] shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-[12.5px] font-semibold transition-transform duration-300 ease-spring active:scale-95 ${
        count > 0 || open ? 'border-accent text-fg' : 'border-line text-fg2'
      } bg-raised`}
    >
      <ListPlus size={17} strokeWidth={2.2} aria-hidden style={{ color: 'var(--accent)' }} />
      {count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Add up'}
    </button>
  );
}

/**
 * Itemised make-up of one number: a line per account, statement or bill.
 * The total feeds the field above it. Lines can subtract, for carving a part
 * out of a statement balance.
 */
export function TallyPanel({
  lines,
  onChange,
  onClear,
  money,
  unit,
  placeholder,
}: {
  lines: TallyLine[];
  onChange: (lines: TallyLine[]) => void;
  /** Drop the list and keep the total as a plain number. */
  onClear: () => void;
  money: boolean;
  unit?: ReactNode;
  placeholder: string;
}) {
  const total = tallySum(lines);
  const patch = (i: number, next: Partial<TallyLine>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...next } : l)));
  return (
    <div className="anim-rise mt-1 mb-2 rounded-2xl border border-line bg-raised/60 p-2.5">
      <ul className="space-y-2">
        {lines.map((l, i) => {
          const negative = l.amount < 0 || Object.is(l.amount, -0);
          return (
            <li key={l.id} className="rounded-xl bg-raised px-2.5 pt-2 pb-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={l.label}
                  maxLength={60}
                  placeholder={i === 0 ? placeholder : 'Label'}
                  aria-label={`Label for item ${i + 1}`}
                  autoComplete="off"
                  autoCorrect="off"
                  onChange={(e) => patch(i, { label: e.target.value })}
                  className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg3"
                />
                <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => onChange(lines.filter((_, k) => k !== i))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg3 active:scale-90">
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  aria-label={negative ? `Item ${i + 1} is subtracted. Switch to add.` : `Item ${i + 1} is added. Switch to subtract.`}
                  aria-pressed={negative}
                  onClick={() => patch(i, { amount: negative ? Math.abs(l.amount) : -Math.abs(l.amount) || -0 })}
                  className="mb-1.5 grid h-[46px] w-11 shrink-0 place-items-center rounded-2xl border border-line text-fg"
                >
                  {negative ? <Minus size={17} strokeWidth={2.6} aria-hidden style={{ color: 'var(--serious)' }} /> : <Plus size={17} strokeWidth={2.6} aria-hidden style={{ color: 'var(--accent)' }} />}
                </button>
                <div className="min-w-0 flex-1">
                  <NumField label="" value={Math.abs(l.amount)} prefix={money ? '$' : undefined} sensitive={money} onChange={(v) => patch(i, { amount: negative ? -Math.abs(v) || -0 : Math.abs(v) })} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => onChange([...lines, newTallyLine()])} className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[14px] font-semibold text-fg">
        <Plus size={16} aria-hidden /> Add another
      </button>
      <div className="mt-2 flex items-baseline justify-between gap-3 px-1.5 pb-0.5">
        <button type="button" onClick={onClear} className="min-h-[36px] text-[12px] text-fg3 underline underline-offset-4">
          Remove list, keep total
        </button>
        <span className="text-[14px] text-fg2">
          Total{' '}
          <span className="num font-semibold text-fg">
            {money ? <Money v={total} /> : total.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            {unit}
          </span>
        </span>
      </div>
    </div>
  );
}
