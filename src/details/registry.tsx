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
  networth: { title: 'Where your money sits', Component: NetWorthDetail },
  bridge: { title: 'The bridge years', Component: BridgeDetail },
  success: { title: 'Your odds, in detail', Component: SuccessDetail },
  property: { title: 'Keep or sell the property', Component: PropertyDetail },
  locked: { title: 'Locked retirement savings', Component: LockedDetail },
  cashflow: { title: 'Money in, money out', Component: CashflowDetail },
  tax: { title: 'Tax & tax-deferred top-ups', Component: TaxDetail },
  ledger: { title: 'Year by year', Component: LedgerDetail },
  'edit-profile': { title: 'Profile & assumptions', Component: EditProfile },
  'edit-liquid': { title: 'Liquid assets', Component: EditLiquid },
  'edit-statutory': { title: 'Statutory retirement accounts', Component: EditStatutory },
  'edit-property': { title: 'Property', Component: EditProperty },
  'edit-income': { title: 'Income', Component: EditIncome },
  'edit-tax': { title: 'Tax & tax-deferred top-ups', Component: EditTax },
  'edit-expenses': { title: 'Expenses', Component: EditExpenses },
  about: { title: 'Privacy and how it works', Component: AboutDetail },
};
