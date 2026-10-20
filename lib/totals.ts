import { Transaction } from '@/constants/types';
import { dayKey, financialDate } from './financialDate';

export type TotalsPeriod = 'semana' | 'mes' | 'ano';
export type TotalsChartFilter = 'debito' | 'credito' | 'total';

export interface TotalsData {
  transactions: Transaction[];
  debit: Transaction[];
  credit: Transaction[];
  income: number;
  expense: number;
  performance: number;
  savingsPercent: number;
  dailyAverage: number;
}

const isGeneratedCardSettlement = (tx: Transaction) => !!tx.cardPaymentId;

/**
 * Totais usa competência: a compra é contabilizada na data em que ocorreu.
 * Os registros técnicos criados para quitar ou antecipar faturas são excluídos,
 * evitando que a mesma compra entre no total uma segunda vez.
 */
export function isTotalsTransaction(tx: Transaction) {
  return !tx.isAdjustment && !tx.isVirtual && !isGeneratedCardSettlement(tx) && tx.type !== 'transferencia';
}

export function isInTotalsPeriod(date: string, period: TotalsPeriod, refDate: Date) {
  const value = financialDate(date);
  if (!Number.isFinite(value.getTime())) return false;
  if (period === 'ano') return value.getFullYear() === refDate.getFullYear();
  if (period === 'mes') return value.getFullYear() === refDate.getFullYear() && value.getMonth() === refDate.getMonth();
  const start = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const key = dayKey(value);
  return key >= dayKey(start) && key <= dayKey(end);
}

export function totalsDaysElapsed(period: TotalsPeriod, refDate: Date, today: Date) {
  const reference = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  if (period === 'semana') {
    const start = new Date(reference);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    if (current < start) return 7;
    return Math.min(7, Math.floor((Math.min(current.getTime(), end.getTime()) - start.getTime()) / 86_400_000) + 1);
  }
  if (period === 'mes') {
    const isCurrent = reference.getFullYear() === current.getFullYear() && reference.getMonth() === current.getMonth();
    return isCurrent ? current.getDate() : new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  }
  const isCurrent = reference.getFullYear() === current.getFullYear();
  if (!isCurrent) return new Date(reference.getFullYear(), 11, 31).getDate() === 31 && ((reference.getFullYear() % 4 === 0 && reference.getFullYear() % 100 !== 0) || reference.getFullYear() % 400 === 0) ? 366 : 365;
  return Math.floor((current.getTime() - new Date(current.getFullYear(), 0, 1, 12).getTime()) / 86_400_000) + 1;
}

export function buildTotalsData({ transactions, period, refDate, today, includePending }: {
  transactions: Transaction[];
  period: TotalsPeriod;
  refDate: Date;
  today: Date;
  includePending: boolean;
}): TotalsData {
  const todayKey = dayKey(today);
  const visible = transactions.filter(tx => {
    const date = financialDate(tx.date);
    if (!isTotalsTransaction(tx) || !Number.isFinite(date.getTime()) || !isInTotalsPeriod(tx.date, period, refDate)) return false;
    return includePending || (tx.paid && dayKey(date) <= todayKey);
  });
  const debit = visible.filter(tx => tx.paymentMethod !== 'credito');
  const credit = visible.filter(tx => tx.paymentMethod === 'credito');
  const income = visible.filter(tx => tx.type === 'receita').reduce((sum, tx) => sum + tx.amount, 0);
  const expense = visible.filter(tx => tx.type === 'despesa').reduce((sum, tx) => sum + tx.amount, 0);
  const performance = income - expense;
  return {
    transactions: visible,
    debit,
    credit,
    income,
    expense,
    performance,
    savingsPercent: income > 0 ? Math.max(0, (performance / income) * 100) : 0,
    dailyAverage: expense / Math.max(1, totalsDaysElapsed(period, refDate, today)),
  };
}
