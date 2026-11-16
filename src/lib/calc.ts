/**
 * Tiny arithmetic evaluator for numeric fields: + - * / and parentheses, with
 * thousands separators ignored. Hand-written parser, no eval.
 * Returns null when the text is not a complete, finite expression.
 */
export function evaluate(text: string): number | null {
  const src = text.replace(/[,\s$]/g, '').replace(/[x×]/gi, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (src === '' || src.length > 200) return null;
  let i = 0;

  const number = (): number | null => {
    const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number | null => {
    if (src[i] === '-') {
      i++;
      const v = factor();
      return v === null ? null : -v;
    }
    if (src[i] === '+') {
      i++;
      return factor();
    }
    if (src[i] === '(') {
      i++;
      const v = sum();
      if (v === null || src[i] !== ')') return null;
      i++;
      return v;
    }
    return number();
  };
  const product = (): number | null => {
    let left = factor();
    while (left !== null && (src[i] === '*' || src[i] === '/')) {
      const op = src[i++];
      const right = factor();
      if (right === null) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  };
  function sum(): number | null {
    let left = product();
    while (left !== null && (src[i] === '+' || src[i] === '-')) {
      const op = src[i++];
      const right = product();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = sum();
  return result !== null && i === src.length && Number.isFinite(result) ? result : null;
}

/** True when the text is more than a plain number, so the result is worth showing. */
export function isExpression(text: string): boolean {
  return /[+*/x×÷()]|\d\s*[-−]/i.test(text);
}
