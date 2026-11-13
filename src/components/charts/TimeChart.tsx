import { useId, useMemo, useState, type PointerEvent, type ReactNode } from 'react';
import { useWidth } from '../../hooks/useSize';
import { compact, money, niceTicks } from '../../lib/format';
import { useApp } from '../../store/context';
import { Legend } from '../ui';

export interface ChartLine {
  id: string;
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
  /** Fill a faint wash under the line. */
  area?: boolean;
}

export interface ChartBand {
  id: string;
  label: string;
  color: string;
  lo: number[];
  hi: number[];
  opacity: number;
}

export interface ChartMarker {
  x: number;
  label: string;
}

export interface TooltipRow {
  label: string;
  value: number;
  color?: string;
}

const MASK = '•••';
const M = { top: 34, right: 6, bottom: 22, left: 2 };

/**
 * Age-indexed line / fan chart with a scrub crosshair.
 *
 * The tooltip is clamped inside the chart's own box, and a chart always lives
 * inside one pane, so on the unfolded display nothing interactive can land on
 * the fold.
 */
export function TimeChart({
  xs,
  lines,
  bands = [],
  markers = [],
  zone,
  height = 220,
  ariaLabel,
  tooltipRows,
  xCaption,
  yCap,
}: {
  xs: number[];
  lines: ChartLine[];
  bands?: ChartBand[];
  markers?: ChartMarker[];
  zone?: { from: number; to: number; label: string };
  height?: number;
  ariaLabel: string;
  tooltipRows?: (index: number) => TooltipRow[];
  xCaption?: (x: number) => ReactNode;
  /** Upper limit for the y-axis. Anything above is clipped at the top edge. */
  yCap?: number;
}) {
  const clipId = useId();
  const { settings } = useApp();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(width, 120);
  const innerW = w - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const x0 = xs[0] ?? 0;
  const x1 = xs[xs.length - 1] ?? 1;

  const { yMin, yMax, ticks, clipped } = useMemo(() => {
    let lo = 0;
    let hi = 0;
    for (const l of lines) {
      for (const v of l.values) {
        if (!Number.isFinite(v)) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    for (const b of bands) {
      for (const v of b.hi) if (Number.isFinite(v)) hi = Math.max(hi, v);
      for (const v of b.lo) if (Number.isFinite(v)) lo = Math.min(lo, v);
    }
    if (yCap !== undefined && yCap > lo && hi > yCap) {
      const t = niceTicks(lo, yCap, 4);
      return { yMin: Math.min(lo, t[0]), yMax: yCap, ticks: t, clipped: true };
    }
    if (hi <= lo) hi = lo + 1;
    const t = niceTicks(lo, hi * 1.06, 4);
    return { yMin: Math.min(lo, t[0]), yMax: Math.max(hi * 1.06, t[t.length - 1]), ticks: t, clipped: false };
  }, [lines, bands, yCap]);

  const sx = (x: number) => M.left + (x1 > x0 ? ((x - x0) / (x1 - x0)) * innerW : 0);
  const sy = (v: number) => M.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const path = (values: number[]) => values.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(xs[i]).toFixed(1)},${sy(v).toFixed(1)}`).join('');
  const bandPath = (b: ChartBand) =>
    `${b.hi.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(xs[i]).toFixed(1)},${sy(v).toFixed(1)}`).join('')}${b.lo
      .map((_, k) => {
        const i = b.lo.length - 1 - k;
        return `L${sx(xs[i]).toFixed(1)},${sy(b.lo[i]).toFixed(1)}`;
      })
      .join('')}Z`;

  // X ticks: decades, plus the first and last age when there is room.
  const xTicks = useMemo(() => {
    const out: number[] = [];
    const span = x1 - x0;
    const step = span > 45 ? 10 : span > 20 ? 5 : span > 8 ? 2 : 1;
    for (let v = Math.ceil(x0 / step) * step; v <= x1; v += step) out.push(v);
    return out;
  }, [x0, x1]);

  // Stagger marker labels onto two rows when they would overlap.
  const placedMarkers = useMemo(() => {
    const sorted = [...markers].filter((m) => m.x >= x0 && m.x <= x1).sort((a, b) => a.x - b.x);
    const rowEnd = [-Infinity, -Infinity];
    return sorted.map((m) => {
      const px = M.left + (x1 > x0 ? ((m.x - x0) / (x1 - x0)) * innerW : 0);
      const textW = m.label.length * 6.1 + 6;
      const anchorEnd = px + textW > w - 2;
      const start = anchorEnd ? px - textW : px;
      const row = start >= rowEnd[0] ? 0 : start >= rowEnd[1] ? 1 : 0;
      rowEnd[row] = start + textW;
      return { ...m, px, row, anchorEnd };
    });
  }, [markers, x0, x1, innerW, w]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - M.left) / innerW));
    setHover(Math.round(frac * (xs.length - 1)));
  };

  const rows: TooltipRow[] = hover === null ? [] : tooltipRows ? tooltipRows(hover) : lines.map((l) => ({ label: l.label, value: l.values[hover], color: l.color }));
  const hoverX = hover === null ? 0 : sx(xs[hover]);
  const tipLeft = hoverX < w / 2;

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
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            onPointerCancel={() => setHover(null)}
          >
            {zone && zone.to > zone.from && (
              <rect x={sx(Math.max(zone.from, x0))} y={M.top} width={Math.max(0, sx(Math.min(zone.to, x1)) - sx(Math.max(zone.from, x0)))} height={innerH} style={{ fill: 'var(--fg)' }} opacity={0.06}>
                <title>{zone.label}</title>
              </rect>
            )}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={w - M.right} y1={sy(t)} y2={sy(t)} style={{ stroke: 'var(--grid)' }} strokeWidth={1} />
                <text x={M.left + 2} y={sy(t) - 4} fontSize={10.5} className="num" style={{ fill: 'var(--fg3)' }}>
                  {settings.privacy ? MASK : compact(t)}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={sx(t)} y={height - 6} fontSize={10.5} textAnchor={t === x0 ? 'start' : t === x1 ? 'end' : 'middle'} className="num" style={{ fill: 'var(--fg3)' }}>
                {t}
              </text>
            ))}
            {placedMarkers.map((m) => (
              <g key={`${m.label}-${m.x}`}>
                <line x1={m.px} x2={m.px} y1={m.row === 0 ? 14 : 27} y2={M.top + innerH} style={{ stroke: 'var(--line-strong)' }} strokeWidth={1} />
                <text x={m.anchorEnd ? m.px - 4 : m.px + 4} y={m.row === 0 ? 11 : 24} fontSize={10.5} fontWeight={600} textAnchor={m.anchorEnd ? 'end' : 'start'} style={{ fill: 'var(--fg2)' }}>
                  {m.label}
                </text>
              </g>
            ))}
            <clipPath id={clipId}>
              <rect x={M.left} y={M.top} width={innerW} height={innerH} />
            </clipPath>
            <g clipPath={`url(#${clipId})`}>
              {bands.map((b) => (
                <path key={b.id} d={bandPath(b)} style={{ fill: b.color }} opacity={b.opacity} />
              ))}
            </g>
            {lines
              .filter((l) => l.area)
              .map((l) => (
                <path key={`${l.id}-area`} d={`${path(l.values)}L${sx(x1).toFixed(1)},${sy(Math.max(0, yMin)).toFixed(1)}L${sx(x0).toFixed(1)},${sy(Math.max(0, yMin)).toFixed(1)}Z`} style={{ fill: l.color }} opacity={0.1} />
              ))}
            {lines.map((l) => (
              <path key={l.id} clipPath={clipped ? `url(#${clipId})` : undefined} d={path(l.values)} fill="none"style={{ stroke: l.color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={l.dashed ? '5 5' : undefined} />
            ))}
            {hover !== null && (
              <g pointerEvents="none">
                <line x1={hoverX} x2={hoverX} y1={M.top} y2={M.top + innerH} style={{ stroke: 'var(--fg2)' }} strokeWidth={1} />
                {lines
                  .filter((l) => l.values[hover] <= yMax)
                  .map((l) => (
                    <circle key={l.id} cx={hoverX} cy={sy(l.values[hover])} r={5} style={{ fill: l.color, stroke: 'var(--solid)' }} strokeWidth={2} />
                  ))}
              </g>
            )}
          </svg>
        )}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-9 z-10 min-w-[150px] rounded-2xl border border-line-strong bg-solid px-3 py-2 text-[12px] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)]"
            style={tipLeft ? { left: Math.min(hoverX + 12, w - 162) } : { right: Math.min(w - hoverX + 12, w - 162) }}
          >
            <div className="num mb-1 font-semibold text-fg">{xCaption ? xCaption(xs[hover]) : `Age ${xs[hover]}`}</div>
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 py-px text-fg2">
                <span className="inline-flex items-center gap-1.5">
                  {r.color && <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
                  {r.label}
                </span>
                <span className="num font-semibold text-fg">{settings.privacy ? MASK : money(r.value, { compact: true })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {lines.length + bands.length >= 2 && (
        <Legend
          items={[
            ...lines.map((l) => ({ label: l.label, color: l.color, kind: l.dashed ? ('dash' as const) : ('line' as const) })),
            ...bands.map((b) => ({ label: b.label, color: b.color, kind: 'band' as const })),
            ...(zone ? [{ label: zone.label, color: 'var(--fg3)', kind: 'band' as const }] : []),
          ]}
        />
      )}
    </div>
  );
}
