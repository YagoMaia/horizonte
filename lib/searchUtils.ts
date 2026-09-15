import { Transaction, TransactionType } from '@/constants/types';
import { formatCurrency } from '@/lib/utils';

export interface SearchFilters {
  type: TransactionType | 'todas';
  accountId: string | 'todas';
  monthPrefix?: string;
  paymentMethod?: 'debito' | 'credito' | 'todas';
}

/**
 * Filters transactions based on a search term and active filters.
 * - Normalizes search term (trim, lowercase)
 * - Matches against description (case-insensitive) OR formatted currency amount
 * - Applies type and account filters ('todas' means no filter)
 * - Returns results sorted by date descending (most recent first)
 */
export function filterTransactions(
  transactions: Transaction[],
  searchTerm: string,
  filters: SearchFilters
): Transaction[] {
  const normalizedTerm = searchTerm.trim().toLowerCase();

  // If search term is empty, no filtering by text — only apply filters
  const filtered = transactions.filter((tx) => {
    if (filters.monthPrefix && (!tx.date || !tx.date.startsWith(filters.monthPrefix))) {
      return false;
    }

    // Apply type filter
    if (filters.type !== 'todas' && tx.type !== filters.type) {
      return false;
    }

    // Apply account filter
    if (
      filters.accountId !== 'todas' &&
      tx.accountId !== filters.accountId &&
      tx.targetAccountId !== filters.accountId
    ) {
      return false;
    }

    if (filters.paymentMethod === 'debito' && tx.paymentMethod === 'credito') return false;
    if (filters.paymentMethod === 'credito' && tx.paymentMethod !== 'credito') return false;

    // If no search term, include all transactions that pass filters
    if (normalizedTerm === '') {
      return true;
    }

    // Match against description (guard against null/undefined)
    const description = (tx.description || '').toLowerCase();
    if (description.includes(normalizedTerm)) {
      return true;
    }

    // Match against formatted currency amount
    const formattedAmount = formatCurrency(tx.amount).toLowerCase();
    if (formattedAmount.includes(normalizedTerm)) {
      return true;
    }

    return false;
  });

  // Sort by date descending (most recent first)
  return filtered.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
}
