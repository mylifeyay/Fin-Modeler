/** Chart hues by entity. The same entity keeps the same hue on every screen. */
export const C = {
  headline: 'var(--c-headline)',
  accessible: 'var(--c-accessible)',
  locked: 'var(--c-locked)',
  property: 'var(--c-property)',
  orange: 'var(--c-orange)',
  magenta: 'var(--c-magenta)',
  green: 'var(--c-green)',
  red: 'var(--c-red)',
} as const;

export const BUCKET_COLOR = {
  cash: C.accessible,
  domEq: C.headline,
  forEq: C.orange,
  bonds: C.magenta,
  alt: C.red,
  deferred: C.green,
  statutory: C.locked,
  property: C.property,
} as const;

export const BUCKET_LABEL = {
  cash: 'Cash & high-yield',
  domEq: 'Domestic equities',
  forEq: 'Foreign equities',
  bonds: 'Fixed income',
  alt: 'Alternatives',
} as const;
