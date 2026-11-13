import type { ComponentType } from 'react';
import type { DetailId } from '../store/context';
import { AboutDetail } from './AboutDetail';
import { BridgeDetail } from './BridgeDetail';
import { CashflowDetail, TaxDetail } from './CashflowDetail';
import { EditExpenses, EditIncome, EditLiquid, EditProfile, EditProperty, EditStatutory, EditTax } from './Editors';
import { LedgerDetail } from './LedgerDetail';
import { LockedDetail } from './LockedDetail';
import { NetWorthDetail } from './NetWorthDetail';
import { PropertyDetail } from './PropertyDetail';
import { SuccessDetail } from './SuccessDetail';

export const DETAILS: Record<DetailId, { title: string; Component: ComponentType }> = {
  networth: { title: 'Net worth breakdown', Component: NetWorthDetail },
  bridge: { title: 'Early-retirement liquidity bridge', Component: BridgeDetail },
  success: { title: 'Monte Carlo outcomes', Component: SuccessDetail },
  property: { title: 'Property: hold vs sell', Component: PropertyDetail },
  locked: { title: 'Statutory accounts', Component: LockedDetail },
  cashflow: { title: 'Cash-flow reconciliation', Component: CashflowDetail },
  tax: { title: 'Tax & tax-deferred top-ups', Component: TaxDetail },
  ledger: { title: 'Annual cash-flow & net worth bridge', Component: LedgerDetail },
  'edit-profile': { title: 'Profile & assumptions', Component: EditProfile },
  'edit-liquid': { title: 'Liquid assets', Component: EditLiquid },
  'edit-statutory': { title: 'Statutory retirement accounts', Component: EditStatutory },
  'edit-property': { title: 'Property', Component: EditProperty },
  'edit-income': { title: 'Income', Component: EditIncome },
  'edit-tax': { title: 'Tax & tax-deferred top-ups', Component: EditTax },
  'edit-expenses': { title: 'Expenses', Component: EditExpenses },
  about: { title: 'Privacy model & method notes', Component: AboutDetail },
};
