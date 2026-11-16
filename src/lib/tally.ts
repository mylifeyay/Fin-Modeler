import type { TallyLine } from '../engine/types';

export const tallySum = (lines: TallyLine[]): number => lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0);

let counter = 0;
export const newTallyLine = (amount = 0): TallyLine => ({ id: `l-${Date.now().toString(36)}-${(counter++).toString(36)}`, label: '', amount });
