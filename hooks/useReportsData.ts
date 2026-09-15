// hooks/useReportsData.ts

import { useMemo } from 'react';
import { Transaction } from '@/constants/types';
import { useStoreContext } from '@/context/StoreContext';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type PeriodMonths = 3 | 6 | 12;

export interface MonthlyData {
  month: string;       // ISO format "YYYY-MM"
  label: string;       // Abbreviated month name (e.g., "Jan", "Fev")
  income: number;
  expense: number;
  netBalance: number;
}

export interface ComparativeSummary {
  currentIncome: number;
  previousIncome: number;
  incomeVariation: number;       // percentage
  currentExpense: number;
  previousExpense: number;
  expenseVariation: number;      // percentage
  currentNetBalance: number;
  previousNetBalance: number;
}

export interface Averages {
  avgIncome: number;
  avgExpense: number;
  avgNetBalance: number;
}

export interface TopTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  accountName: string;
}

export interface ReportsData {
  monthlyData: MonthlyData[];
  comparativeSummary: ComparativeSummary;
  averages: Averages;
  topExpenses: TopTransaction[];
  topIncomes: TopTransaction[];
  isEmpty: boolean;
  isLoading: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Pure Computation Functions ───────────────────────────────────────────────

/**
 * Filters transactions to include only paid ones and exclude transfers.
 */
export function filterTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(
    (t) => t.paid === true && t.type !== 'transferencia'
  );
}

/**
 * Groups transactions by their competence month (YYYY-MM derived from date).
 */
export function groupByMonth(transactions: Transaction[]): Map<string, Transaction[]> {
  const grouped = new Map<string, Transaction[]>();

  for (const t of transactions) {
    // Extract YYYY-MM from the date string
    const monthKey = t.date.substring(0, 7);

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(t);
  }

  return grouped;
}

/**
 * Computes income/expense/netBalance per month for the selected period.
 * Returns months counting backwards from the current month.
 * Months with zero transactions show 0 values (not omitted).
 */
export function computeMonthlyTotals(
  grouped: Map<string, Transaction[]>,
  periodMonths: PeriodMonths
): MonthlyData[] {
  const now = new Date();
  const result: MonthlyData[] = [];

  for (let i = periodMonths - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    const transactions = grouped.get(monthKey) || [];

    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      if (t.type === 'receita') {
        income += t.amount;
      } else if (t.type === 'despesa') {
        expense += t.amount;
      }
    }

    const netBalance = income - expense;

    result.push({
      month: monthKey,
      label: MONTH_ABBR[month],
      income,
      expense,
      netBalance,
    });
  }

  return result;
}

/**
 * Returns percentage change: ((current - previous) / previous) * 100.
 * Returns 0 if previous is 0 (avoids division by zero).
 */
export function computePercentageVariation(current: number, previous: number): number {
  if (previous === 0) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Compares current month vs previous month from the monthlyData array.
 * Uses the last two entries of monthlyData as current and previous.
 */
export function computeComparativeSummary(monthlyData: MonthlyData[]): ComparativeSummary {
  const empty: ComparativeSummary = {
    currentIncome: 0,
    previousIncome: 0,
    incomeVariation: 0,
    currentExpense: 0,
    previousExpense: 0,
    expenseVariation: 0,
    currentNetBalance: 0,
    previousNetBalance: 0,
  };

  if (monthlyData.length === 0) {
    return empty;
  }

  const current = monthlyData[monthlyData.length - 1];
  const previous = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null;

  const previousIncome = previous?.income ?? 0;
  const previousExpense = previous?.expense ?? 0;
  const previousNetBalance = previous?.netBalance ?? 0;

  return {
    currentIncome: current.income,
    previousIncome,
    incomeVariation: computePercentageVariation(current.income, previousIncome),
    currentExpense: current.expense,
    previousExpense,
    expenseVariation: computePercentageVariation(current.expense, previousExpense),
    currentNetBalance: current.netBalance,
    previousNetBalance,
  };
}

/**
 * Averages the last 3 months of the monthlyData array.
 * If fewer than 3 months are available, averages what's available.
 */
export function computeAverages(monthlyData: MonthlyData[]): Averages {
  if (monthlyData.length === 0) {
    return { avgIncome: 0, avgExpense: 0, avgNetBalance: 0 };
  }

  const last3 = monthlyData.slice(-3);
  const count = last3.length;

  const totalIncome = last3.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = last3.reduce((sum, m) => sum + m.expense, 0);
  const totalNetBalance = last3.reduce((sum, m) => sum + m.netBalance, 0);

  return {
    avgIncome: totalIncome / count,
    avgExpense: totalExpense / count,
    avgNetBalance: totalNetBalance / count,
  };
}

/**
 * Returns top N transactions of given type sorted by amount descending.
 * Filters by type from the provided (already filtered) transactions.
 */
export function getTopTransactions(
  transactions: Transaction[],
  type: 'receita' | 'despesa',
  limit: number
): Transaction[] {
  return transactions
    .filter((t) => t.type === type)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}


// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Main hook that processes all report data from the store.
 * Memoizes all computed values to prevent unnecessary recalculations.
 */
export function useReportsData(periodMonths: PeriodMonths): ReportsData {
  const { transactionIndexes, accounts, loading } = useStoreContext();
  const filteredTransactions = transactionIndexes.reportingTransactions;
  const grouped = transactionIndexes.reportingByMonth;

  const monthlyData = useMemo(
    () => computeMonthlyTotals(grouped, periodMonths),
    [grouped, periodMonths]
  );

  const comparativeSummary = useMemo(
    () => computeComparativeSummary(monthlyData),
    [monthlyData]
  );

  const averages = useMemo(
    () => computeAverages(monthlyData),
    [monthlyData]
  );

  const topExpenses = useMemo(() => {
    const topTx = getTopTransactions(filteredTransactions, 'despesa', 5);
    return topTx.map((t): TopTransaction => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      accountName: accounts.find((a) => a.id === t.accountId)?.name ?? 'Conta removida',
    }));
  }, [filteredTransactions, accounts]);

  const topIncomes = useMemo(() => {
    const topTx = getTopTransactions(filteredTransactions, 'receita', 5);
    return topTx.map((t): TopTransaction => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      accountName: accounts.find((a) => a.id === t.accountId)?.name ?? 'Conta removida',
    }));
  }, [filteredTransactions, accounts]);

  const isEmpty = filteredTransactions.length === 0;

  return {
    monthlyData,
    comparativeSummary,
    averages,
    topExpenses,
    topIncomes,
    isEmpty,
    isLoading: loading,
  };
}
