// hooks/useTransactionSearch.ts
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Transaction, TransactionType } from '@/constants/types'
import { filterTransactions, SearchFilters } from '@/lib/searchUtils'

const DEBOUNCE_MS = 300
const PAGE_SIZE = 20

export interface UseTransactionSearchResult {
  searchTerm: string
  setSearchTerm: (term: string) => void
  clearSearch: () => void
  isSearchActive: boolean
  searchResults: Transaction[]
  displayedResults: Transaction[]
  loadMore: () => void
  hasMore: boolean
}

export function useTransactionSearch(
  transactions: Transaction[],
  filters: {
    type: TransactionType | 'todas'
    accountId: string | 'todas'
    monthPrefix?: string
    paymentMethod?: 'debito' | 'credito' | 'todas'
  }
): UseTransactionSearchResult {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce the search term
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [searchTerm])

  // Reset pagination when debounced term or filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE)
  }, [debouncedTerm, filters.type, filters.accountId, filters.monthPrefix, filters.paymentMethod])

  // Compute search results using the pure filter function
  const searchResults = useMemo(() => {
    const trimmed = debouncedTerm.trim()
    if (trimmed === '') {
      return []
    }
    const searchFilters: SearchFilters = {
      type: filters.type,
      accountId: filters.accountId,
      monthPrefix: filters.monthPrefix,
      paymentMethod: filters.paymentMethod,
    }
    return filterTransactions(transactions, trimmed, searchFilters)
  }, [transactions, debouncedTerm, filters.type, filters.accountId, filters.monthPrefix, filters.paymentMethod])

  // Paginated results
  const displayedResults = useMemo(() => {
    return searchResults.slice(0, displayCount)
  }, [searchResults, displayCount])

  const hasMore = displayCount < searchResults.length

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount((prev) => prev + PAGE_SIZE)
    }
  }, [hasMore])

  const isSearchActive = debouncedTerm.trim() !== ''

  const clearSearch = useCallback(() => {
    setSearchTerm('')
    setDebouncedTerm('')
    setDisplayCount(PAGE_SIZE)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return {
    searchTerm,
    setSearchTerm,
    clearSearch,
    isSearchActive,
    searchResults,
    displayedResults,
    loadMore,
    hasMore,
  }
}
