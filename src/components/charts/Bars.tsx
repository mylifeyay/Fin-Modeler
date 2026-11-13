import { useState, type ReactNode } from 'react';
import { useWidth } from '../../hooks/useSize';
import { useApp } from '../../store/context';
import { Money } from '../ui';

export interface Bar {
  key: string;
  value: number;
  /** Tooltip heading. */
  title: string;
  /** Optional second tooltip line. */
  detail?: ReactNode;
}

/**
 * Column chart for one series: distributions and yearly flows. Bars are
 * capped at 24px, rounded at the data end, square on the baseline, and
 * separated by a 2px gap. Negative values hang below the zero line.
 */
export function Bars({
  bars,
  color,
  negativeColor,
  height = 150,
  ariaLabel,
  axis,
  unit,
}: {
  bars: Bar[];
  color: string;
  negativeColor?: string;
  height?: number;
  ariaLabel: string;
  /** Labels under the first, middle and last bar. */
  axis?: [ReactNode, ReactNode, ReactNode];
  /** 'money' formats tooltip values as money, 'count' as a plain number. */
  unit: 'money' | 'count';
}) {
  const { settings } = useApp();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(width, 100);
  const top = 8;
  const bottom = 4;
  const innerH = height - top - bottom;
  const max = Math.max(0, ...bars.map((b) => b.value));
  const min = Math.min(0, ...bars.map((b) => b.value));
  const span = max - min || 1;
  const slot = w / Math.max(1, bars.length);
  const bw = Math.max(1, Math.min(24, slot - 2));
  const zeroY = top + (max / span) * innerH;
  const active = hover !== null ? bars[hover] : null;

  return (
    <div>
      <div ref={ref} className="relative select-none" style={{ height }}>
        {width > 0 && (
          <svg
            width={w}
            height={height}
            role="img"
            aria-label={ariaLabel}
            className="block touch-pan-y"
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(Math.min(bars.length - 1, Math.max(0, Math.floor((e.clientX - rect.left) / slot))));
            }}
            onPointerLeave={() => setHover(null)}
            onPointerCancel={() => setHover(null)}
          >
            <line x1={0} x2={w} y1={zeroY} y2={zeroY} style={{ stroke: 'var(--line-strong)' }} strokeWidth={1} />
            {bars.map((b, i) => {
              const h = Math.max(b.value === 0 ? 0 : 1.5, (Math.abs(b.value) / span) * innerH);
              const x = i * slot + (slot - bw) / 2;
              const up = b.value >= 0;
              const y = up ? zeroY - h : zeroY;
              const r = Math.min(4, bw / 2, h);
              const d = up
                ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z`
                : `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + bw - r}Q${x + bw},${y + h} ${x + bw},${y + h - r}V${y}Z`;
              return <path key={b.key} d={d} style={{ fill: up ? color : (negativeColor ?? color) }} opacity={hover === null || hover === i ? 1 : 0.45} />;
            })}
          </svg>
        )}
        {active && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl border border-line-strong bg-solid px-2.5 py-1.5 text-[12px] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]"
            style={hover * slot < w / 2 ? { left: Math.min(hover * slot + slot, w - 150) } : { right: Math.min(w - hover * slot, w - 150) }}
          >
            <div className="font-semibold text-fg">{active.title}</div>
            <div className="num text-fg2">
              {unit === 'money' ? settings.privacy ? '•••' : <Money v={active.value} compact /> : `${Math.round(active.value).toLocaleString('en-US')} paths`}
              {active.detail && <span> {active.detail}</span>}
            </div>
          </div>
        )}
      </div>
      {axis && (
        <div className="num mt-1 flex justify-between text-[10.5px] text-fg3">
          <span>{axis[0]}</span>
          <span>{axis[1]}</span>
          <span>{axis[2]}</span>
        </div>
      )}
    </div>
  );
}
