import { describe, expect, it } from 'vitest';
import { evaluate, isExpression } from './calc';

describe('field calculator', () => {
  it('reads plain numbers with separators', () => {
    expect(evaluate('12,500')).toBe(12500);
    expect(evaluate(' 3.5 ')).toBe(3.5);
    expect(evaluate('-40')).toBe(-40);
  });
  it('adds up several accounts', () => {
    expect(evaluate('12,000 + 48,500+3500')).toBe(64000);
  });
  it('respects precedence and parentheses', () => {
    expect(evaluate('100000*0.6+2000')).toBe(62000);
    expect(evaluate('(1000+500)/3')).toBe(500);
    expect(evaluate('80000 x 0.25')).toBe(20000);
  });
  it('rejects incomplete or unsafe input', () => {
    expect(evaluate('')).toBeNull();
    expect(evaluate('12+')).toBeNull();
    expect(evaluate('(5+2')).toBeNull();
    expect(evaluate('1/0')).toBeNull();
    expect(evaluate('alert(1)')).toBeNull();
    expect(evaluate('1e9')).toBeNull();
  });
  it('tells sums from plain numbers', () => {
    expect(isExpression('1200')).toBe(false);
    expect(isExpression('-1200')).toBe(false);
    expect(isExpression('1200+300')).toBe(true);
    expect(isExpression('1200 - 300')).toBe(true);
  });
});
