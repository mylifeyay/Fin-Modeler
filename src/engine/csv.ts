import type { Projection, YearRow } from './types';

type Column = { header: string; get: (r: YearRow) => number | string; money?: boolean };

const COLUMNS: Column[] = [
  { header: 'Year', get: (r) => r.year },
  { header: 'Age', get: (r) => r.age },
  { header: 'Phase', get: (r) => r.phase },
  { header: 'Salary', get: (r) => r.salary, money: true },
  { header: 'Bonus', get: (r) => r.bonus, money: true },
  { header: 'Net rental income', get: (r) => r.rentNet, money: true },
  { header: 'Dividends and coupons', get: (r) => r.dividends, money: true },
  { header: 'Secondary income', get: (r) => r.secondary, money: true },
  { header: 'Statutory lifetime payout', get: (r) => r.statutoryPayout, money: true },
  { header: 'Tax-deferred withdrawal', get: (r) => r.deferredWithdrawal, money: true },
  { header: 'Employee statutory contribution', get: (r) => r.employeeContribution, money: true },
  { header: 'Employer statutory contribution', get: (r) => r.employerContribution, money: true },
  { header: 'Healthcare overflow', get: (r) => r.maOverflow, money: true },
  { header: 'Chargeable income', get: (r) => r.chargeableIncome, money: true },
  { header: 'Income tax', get: (r) => r.tax, money: true },
  { header: 'Tax-deferred contribution', get: (r) => r.deferredContribution, money: true },
  { header: 'Living expenses', get: (r) => r.living, money: true },
  { header: 'One-off expenses', get: (r) => r.oneOff, money: true },
  { header: 'Mortgage paid in cash', get: (r) => r.mortgageCash, money: true },
  { header: 'Mortgage paid from OA', get: (r) => r.mortgageOa, money: true },
  { header: 'Sale: free cash unlocked', get: (r) => r.saleFreeCash, money: true },
  { header: 'Sale: refunded to statutory account', get: (r) => r.saleRefund, money: true },
  { header: 'Net cash flow', get: (r) => r.netCashFlow, money: true },
  { header: 'Unfunded shortfall', get: (r) => r.shortfall, money: true },
  { header: 'Cash', get: (r) => r.cash, money: true },
  { header: 'Domestic equities', get: (r) => r.domEq, money: true },
  { header: 'Foreign equities (base ccy)', get: (r) => r.forEq, money: true },
  { header: 'Bonds', get: (r) => r.bonds, money: true },
  { header: 'Alternatives (after haircut)', get: (r) => r.alt, money: true },
  { header: 'Tax-deferred account', get: (r) => r.deferred, money: true },
  { header: 'Ordinary account', get: (r) => r.oa, money: true },
  { header: 'Special account', get: (r) => r.sa, money: true },
  { header: 'Healthcare account', get: (r) => r.ma, money: true },
  { header: 'Retirement account', get: (r) => r.ra, money: true },
  { header: 'Annuity premium', get: (r) => r.annuity, money: true },
  { header: 'Property value', get: (r) => r.propValue, money: true },
  { header: 'Mortgage balance', get: (r) => r.mortgage, money: true },
  { header: 'Housing principal used', get: (r) => r.housingPrincipal, money: true },
  { header: 'Housing accrued interest', get: (r) => r.housingAccrued, money: true },
  { header: 'Accessible net worth (end)', get: (r) => r.accessible, money: true },
  { header: 'Headline net worth (end)', get: (r) => r.headline, money: true },
  { header: 'Price index (end)', get: (r) => r.inflClose.toFixed(4) },
];

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Year-by-year schedule. `real` deflates money columns to today's dollars. */
export function projectionToCsv(projection: Projection, real: boolean): string {
  const lines = [COLUMNS.map((c) => cell(c.header)).join(',')];
  for (const r of projection.rows) {
    lines.push(
      COLUMNS.map((c) => {
        const v = c.get(r);
        if (c.money && typeof v === 'number') return cell(Math.round(real ? v / r.inflClose : v));
        return cell(v);
      }).join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
