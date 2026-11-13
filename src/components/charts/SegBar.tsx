import { percent } from '../../lib/format';
import { Money } from '../ui';

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** One whole split into parts, with a legend that carries every value. */
export function SegBar({ segments, ariaLabel }: { segments: Segment[]; ariaLabel: string }) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
        {total > 0 ? (
          shown.map((s) => <div key={s.label} title={s.label} style={{ background: s.color, width: `${(s.value / total) * 100}%` }} className="h-full min-w-[3px]" />)
        ) : (
          <div className="h-full w-full bg-raised" />
        )}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-5 gap-y-1.5 text-[13px]">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-fg2">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="num shrink-0 text-fg">
              <Money v={s.value} compact />
              <span className="ml-2 inline-block w-9 text-right text-fg3">{total > 0 ? percent(Math.max(0, s.value) / total) : '—'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
