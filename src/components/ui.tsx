import { useState, type CSSProperties, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, XCircle, type LucideIcon } from 'lucide-react';
import { money } from '../lib/format';

/** A monetary value. Blurred everywhere when Privacy Blur is on. */
export function Money({ v, compact, sign, className = '' }: { v: number; compact?: boolean; sign?: boolean; className?: string }) {
  return <span className={`money num ${className}`}>{money(v, { compact, sign })}</span>;
}

export function Card({
  children,
  onClick,
  selected,
  className = '',
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  label?: string;
}) {
  if (!onClick) return <div className={`card p-4 ${className}`}>{children}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected ?? false} aria-label={label} className={`card p-4 ${className}`}>
      {children}
    </button>
  );
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-[11px] font-semibold uppercase tracking-[0.09em] text-fg3 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-end justify-between px-1">
      <Eyebrow>{children}</Eyebrow>
      {action}
    </div>
  );
}

export type Tone = 'good' | 'warning' | 'critical' | 'neutral';

const TONE_ICON: Record<Tone, LucideIcon> = { good: CheckCircle2, warning: AlertTriangle, critical: XCircle, neutral: Info };
const TONE_COLOR: Record<Tone, string> = { good: 'var(--good)', warning: 'var(--warning)', critical: 'var(--critical)', neutral: 'var(--fg3)' };

/** Status chip. Colour never carries the state alone: icon and label always ship with it. */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const Icon = TONE_ICON[tone];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-raised py-1 pr-2.5 pl-2 text-[12px] font-semibold whitespace-nowrap text-fg">
      <Icon size={14} strokeWidth={2.4} style={{ color: TONE_COLOR[tone] }} aria-hidden />
      {children}
    </span>
  );
}

/** One line of a reconciliation: label left, figure right. */
export function Row({
  label,
  children,
  hint,
  strong,
  indent,
  swatch,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  strong?: boolean;
  indent?: boolean;
  swatch?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-[9px] ${strong ? 'border-t border-line-strong font-semibold text-fg' : 'text-fg2'} ${indent ? 'pl-4' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[14px]">
          {swatch && <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: swatch }} />}
          <span className="truncate">{label}</span>
        </div>
        {hint && <div className="mt-0.5 text-[12px] leading-snug text-fg3">{hint}</div>}
      </div>
      <div className={`num shrink-0 text-right text-[14px] ${strong ? 'text-fg' : 'text-fg'}`}>{children}</div>
    </div>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card px-4 py-2 ${className}`}>{children}</div>;
}

export function Note({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  const Icon = TONE_ICON[tone];
  return (
    <div className="flex gap-2.5 rounded-2xl border border-line bg-raised px-3.5 py-3 text-[13px] leading-snug text-fg2">
      <Icon size={16} className="mt-px shrink-0" style={{ color: TONE_COLOR[tone] }} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  icon: Icon,
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const look =
    variant === 'primary'
      ? 'bg-accent text-accent-ink border-transparent'
      : variant === 'danger'
        ? 'bg-raised text-fg border-critical/60'
        : 'bg-raised text-fg border-line';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border px-4 text-[15px] font-semibold transition-transform duration-300 ease-spring active:scale-[0.97] disabled:opacity-40 ${look} ${className}`}
    >
      {Icon && <Icon size={17} strokeWidth={2.2} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-full border transition-transform duration-300 ease-spring active:scale-90 ${
        active ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-raised text-fg'
      }`}
    >
      <Icon size={19} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-line bg-raised p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[38px] rounded-xl px-2 text-[13px] font-semibold transition-all duration-300 ease-spring ${
              on ? 'bg-solid text-fg shadow-[0_2px_8px_rgba(0,0,0,0.25)]' : 'text-fg2'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: ReactNode }) {
  return (
    <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-[15px] text-fg">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-fg3">{hint}</span>}
      </span>
      <span className="relative inline-flex h-[31px] w-[51px] shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
        <span className="absolute inset-0 rounded-full bg-raised transition-colors duration-200 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-spring peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Thumb-friendly slider with its value on the label line. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => ReactNode;
  hint?: ReactNode;
}) {
  const clamped = Math.min(max, Math.max(min, value));
  const p = max > min ? ((clamped - min) / (max - min)) * 100 : 0;
  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] text-fg2">{label}</span>
        <span className="num text-[15px] font-semibold text-fg">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        className="slider"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${p}%` } as CSSProperties}
      />
      {hint && <div className="-mt-1 text-[12px] leading-snug text-fg3">{hint}</div>}
    </div>
  );
}

function display(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** Numeric input. Keeps the raw text while typing, commits a clamped number. */
export function NumField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max = 1e12,
  hint,
  sensitive,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  hint?: ReactNode;
  /** Monetary input: blurred when Privacy Blur is on and the field is not focused. */
  sensitive?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <label className="block py-1.5">
      <span className="mb-1 block text-[13px] text-fg2">{label}</span>
      <span className="flex min-h-[46px] items-center gap-1.5 rounded-2xl border border-line bg-raised px-3.5 focus-within:border-accent">
        {prefix && <span className="text-[14px] text-fg3">{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className={`num min-w-0 flex-1 bg-transparent py-2 text-[16px] text-fg outline-none ${sensitive && text === null ? 'money' : ''}`}
          value={text ?? display(value)}
          onFocus={(e) => {
            setText(Number.isFinite(value) && value !== 0 ? String(value) : '');
            requestAnimationFrame(() => e.target.select());
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            const n = Number(raw.replace(/,/g, '').trim());
            if (raw.trim() === '') onChange(Math.max(min, 0));
            else if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => setText(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        {suffix && <span className="text-[14px] text-fg3">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-[12px] leading-snug text-fg3">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  maxLength,
  autoComplete = 'off',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password' | 'month';
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <label className="block py-1.5">
      <span className="mb-1 block text-[13px] text-fg2">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="num min-h-[46px] w-full rounded-2xl border border-line bg-raised px-3.5 text-[16px] text-fg outline-none placeholder:text-fg3 focus:border-accent"
      />
    </label>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3">{children}</div>;
}

export function Group({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <Eyebrow className="mb-1.5 px-1">{title}</Eyebrow>
      <div className="card px-4 py-2.5">{children}</div>
      {note && <div className="mt-1.5 px-1 text-[12px] leading-snug text-fg3">{note}</div>}
    </section>
  );
}

export function Chevron() {
  return <ChevronRight size={16} className="shrink-0 text-fg3" aria-hidden />;
}

export function Legend({ items }: { items: { label: string; color: string; kind?: 'line' | 'dash' | 'band' | 'box' }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[12px] text-fg2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.kind === 'band' || i.kind === 'box' ? (
            <span aria-hidden className="inline-block h-2.5 w-3.5 rounded-[3px]" style={{ background: i.color, opacity: i.kind === 'band' ? 0.4 : 1 }} />
          ) : (
            <span
              aria-hidden
              className="inline-block h-0 w-4 border-t-2"
              style={{ borderColor: i.color, borderTopStyle: i.kind === 'dash' ? 'dashed' : 'solid' }}
            />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}
