import { useId } from 'react';

export type Mood = 'happy' | 'calm' | 'worried' | 'sad' | 'sleepy' | 'wave' | 'party';

/**
 * Pip, the nest egg. An original inline-SVG character that reflects how the
 * plan is doing. Purely decorative: the status it mirrors is always stated in
 * text beside it.
 */
export function Mascot({ mood = 'calm', size = 72, className = '' }: { mood?: Mood; size?: number; className?: string }) {
  const id = useId();
  const smiling = mood === 'happy' || mood === 'party' || mood === 'wave';
  const asleep = mood === 'sleepy';
  const uneasy = mood === 'worried' || mood === 'sad';

  return (
    <svg width={size} height={size} viewBox="0 0 96 96" className={`mascot shrink-0 ${asleep ? 'mascot-sleep' : ''} ${className}`} aria-hidden>
      <defs>
        <radialGradient id={`${id}-shell`} cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.6" stopColor="#fbeecb" />
          <stop offset="1" stopColor="#efd49a" />
        </radialGradient>
        <linearGradient id={`${id}-nest`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d99a2b" />
          <stop offset="1" stopColor="#a86c12" />
        </linearGradient>
      </defs>

      <ellipse cx="48" cy="88" rx="30" ry="4" fill="#000" opacity="0.18" />

      <g className="mascot-body">
        {/* arms sit behind the shell */}
        {mood === 'wave' || mood === 'party' ? (
          <path className="mascot-arm" d="M70 52 Q84 42 80 28" fill="none" stroke="#efd49a" strokeWidth="6" strokeLinecap="round" />
        ) : (
          <path d="M70 56 Q79 60 77 68" fill="none" stroke="#efd49a" strokeWidth="6" strokeLinecap="round" />
        )}
        {mood === 'party' ? (
          <path d="M26 52 Q12 42 16 28" fill="none" stroke="#efd49a" strokeWidth="6" strokeLinecap="round" />
        ) : (
          <path d="M26 56 Q17 60 19 68" fill="none" stroke="#efd49a" strokeWidth="6" strokeLinecap="round" />
        )}

        {/* shell */}
        <path d="M48 8 C66 8 78 32 78 52 C78 70 65 82 48 82 C31 82 18 70 18 52 C18 32 30 8 48 8 Z" fill={`url(#${id}-shell)`} stroke="#d9b56c" strokeWidth="1.5" />
        <ellipse cx="38" cy="26" rx="7" ry="10" fill="#fff" opacity="0.55" transform="rotate(-18 38 26)" />
        {mood === 'sad' && <path d="M52 9 l-4 8 6 4 -5 7" fill="none" stroke="#b98a3c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}

        {/* cheeks */}
        <ellipse cx="31" cy="56" rx="5.5" ry="3.5" fill="#ff9aa8" opacity={uneasy ? 0.25 : 0.6} />
        <ellipse cx="65" cy="56" rx="5.5" ry="3.5" fill="#ff9aa8" opacity={uneasy ? 0.25 : 0.6} />

        {/* brows */}
        {uneasy && (
          <>
            <path d="M32 40 L41 43" stroke="#3a2c16" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M64 40 L55 43" stroke="#3a2c16" strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}

        {/* eyes */}
        {asleep ? (
          <>
            <path d="M33 49 Q37 52 41 49" fill="none" stroke="#3a2c16" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M55 49 Q59 52 63 49" fill="none" stroke="#3a2c16" strokeWidth="2.4" strokeLinecap="round" />
          </>
        ) : mood === 'happy' || mood === 'party' ? (
          <>
            <path d="M33 50 Q37 44 41 50" fill="none" stroke="#3a2c16" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M55 50 Q59 44 63 50" fill="none" stroke="#3a2c16" strokeWidth="2.6" strokeLinecap="round" />
          </>
        ) : (
          <g className="mascot-eyes">
            <ellipse cx="37" cy="49" rx="3.4" ry="4.2" fill="#3a2c16" />
            <ellipse cx="59" cy="49" rx="3.4" ry="4.2" fill="#3a2c16" />
            <circle cx="38.3" cy="47.4" r="1.2" fill="#fff" />
            <circle cx="60.3" cy="47.4" r="1.2" fill="#fff" />
          </g>
        )}

        {/* mouth */}
        {smiling ? (
          <path d="M41 59 Q48 67 55 59" fill="#7a3b2e" stroke="#3a2c16" strokeWidth="2" strokeLinejoin="round" />
        ) : mood === 'sad' ? (
          <path d="M42 64 Q48 58 54 64" fill="none" stroke="#3a2c16" strokeWidth="2.2" strokeLinecap="round" />
        ) : mood === 'worried' ? (
          <path d="M42 62 q3 -3 6 0 t6 0" fill="none" stroke="#3a2c16" strokeWidth="2.2" strokeLinecap="round" />
        ) : asleep ? (
          <ellipse cx="48" cy="62" rx="2.4" ry="2" fill="#3a2c16" />
        ) : (
          <path d="M43 60 Q48 64 53 60" fill="none" stroke="#3a2c16" strokeWidth="2.2" strokeLinecap="round" />
        )}

        {mood === 'worried' && <path d="M71 30 q4 6 0 9 q-4 -3 0 -9 Z" fill="#7cc4ff" />}
      </g>

      {/* nest */}
      <path d="M14 68 Q48 80 82 68 Q80 90 48 90 Q16 90 14 68 Z" fill={`url(#${id}-nest)`} />
      <path d="M17 72 Q34 80 50 76 M30 84 Q52 80 78 73 M22 79 Q44 88 72 81" fill="none" stroke="#f3c56a" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />

      {asleep && (
        <g className="mascot-z" fill="none" stroke="var(--fg2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M72 18 h7 l-7 8 h7" />
          <path d="M84 6 h5 l-5 6 h5" opacity="0.7" />
        </g>
      )}
      {mood === 'party' && (
        <g>
          <path d="M40 10 L48 -4 L56 10 Z" fill="var(--c-magenta)" />
          <circle cx="48" cy="-4" r="3" fill="var(--warning)" />
        </g>
      )}
    </svg>
  );
}
