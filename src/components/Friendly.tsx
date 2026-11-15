import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { money } from '../lib/format';
import { Mascot, type Mood } from './Mascot';
import type { Tone } from './ui';

const TONE_COLOR: Record<Tone, string> = { good: 'var(--good)', warning: 'var(--warning)', critical: 'var(--critical)', neutral: 'var(--fg3)' };

/** Pip with a speech bubble. The bubble carries the actual message. */
export function Says({ mood, children, size = 64 }: { mood: Mood; children: ReactNode; size?: number }) {
  return (
    <div className="flex items-end gap-2.5">
      <Mascot mood={mood} size={size} />
      <div className="bubble relative mb-3 min-w-0 flex-1 rounded-[20px] rounded-bl-md border border-line bg-raised px-3.5 py-2.5 text-[14px] leading-snug text-fg">{children}</div>
    </div>
  );
}

/** A money figure that glides to its new value instead of snapping. */
export function CountMoney({ v, compact, className = '' }: { v: number; compact?: boolean; className?: string }) {
  const [shown, setShown] = useState(v);
  const from = useRef(v);
  useEffect(() => {
    const start = from.current;
    if (start === v) return;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = v;
      const id = requestAnimationFrame(() => setShown(v));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 480);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = start + (v - start) * eased;
      from.current = cur;
      setShown(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return <span className={`money num ${className}`}>{money(shown, { compact })}</span>;
}

/** Circular gauge for a 0 to 1 share. The number in the middle and the label beside it carry the value. */
export function Ring({ value, tone, size = 92, children }: { value: number | null; tone: Tone; size?: number; children: ReactNode }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = value === null ? 0 : Math.min(1, Math.max(0, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--raised)' }} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={{ stroke: TONE_COLOR[tone], transition: 'stroke-dashoffset 700ms var(--ease-spring), stroke 300ms ease' }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export interface JourneyStop {
  key: string;
  label: string;
  age: number;
  year: number;
  /** Colour of the dot. */
  color: string;
}

/** The plan as a path: today, then each milestone in order. */
export function Journey({ stops, bridge }: { stops: JourneyStop[]; bridge?: { fromKey: string; toKey: string; tone: Tone } }) {
  const fromIdx = bridge ? stops.findIndex((s) => s.key === bridge.fromKey) : -1;
  const toIdx = bridge ? stops.findIndex((s) => s.key === bridge.toKey) : -1;
  return (
    <ol className="flex items-start" aria-label="Plan milestones">
      {stops.map((s, i) => {
        const inBridge = bridge && fromIdx >= 0 && toIdx > fromIdx && i >= fromIdx && i < toIdx;
        return (
          <li key={s.key} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {i < stops.length - 1 && (
              <span
                aria-hidden
                className="absolute top-[9px] left-1/2 h-[4px] w-full rounded-full"
                style={{ background: inBridge && bridge ? TONE_COLOR[bridge.tone] : 'var(--raised)', opacity: inBridge ? 0.85 : 1 }}
              />
            )}
            <span aria-hidden className="relative z-[1] h-[22px] w-[22px] rounded-full border-[3px]" style={{ background: s.color, borderColor: 'var(--solid)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
            <span className="mt-1.5 w-full truncate px-0.5 text-[11.5px] font-semibold text-fg">{s.label}</span>
            <span className="num w-full truncate text-[11px] text-fg3">
              {s.age} · {s.year}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const CONFETTI_COLORS = ['var(--c-accessible)', 'var(--c-headline)', 'var(--warning)', 'var(--c-magenta)', 'var(--c-property)', 'var(--accent)'];

/** A short burst of paper. Pointer-transparent, gone in under three seconds. */
export function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {Array.from({ length: 44 }, (_, i) => {
        // Deterministic scatter: no randomness needed for it to look random.
        const left = (i * 37 + 11) % 100;
        const delay = ((i * 53) % 60) / 100;
        const dur = 1.5 + ((i * 29) % 90) / 100;
        const drift = ((i * 71) % 120) - 60;
        const style = {
          left: `${left}%`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDelay: `${delay}s`,
          animationDuration: `${dur}s`,
          '--drift': `${drift}px`,
          '--spin': `${360 + ((i * 97) % 540)}deg`,
          borderRadius: i % 3 === 0 ? '50%' : '2px',
          width: i % 2 ? 8 : 6,
          height: i % 2 ? 12 : 8,
        } as CSSProperties;
        return <span key={i} className="confetti absolute -top-4" style={style} />;
      })}
    </div>
  );
}

/** Soft tinted tile behind an icon. */
export function IconTile({ color, children, size = 34 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[12px]" style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 20%, transparent)` }}>
      {children}
    </span>
  );
}
