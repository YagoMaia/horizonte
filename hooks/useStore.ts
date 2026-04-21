// hooks/useStore.ts
import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Transaction, Account, Tag } from '@/constants/types'

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  TAGS: '@horizonte:tags',
  MONTHLY_BUDGET: '@horizonte:monthly_budget',
}

const DEFAULT_TAGS: Tag[] = [
  { id: '1', name: 'Alimentação', color: '#FF7043', icon: 'fast-food' },
  { id: '2', name: 'Transporte', color: '#42A5F5', icon: 'car' },
  { id: '3', name: 'Saúde', color: '#66BB6A', icon: 'medical' },
  { id: '4', name: 'Lazer', color: '#AB47BC', icon: 'game-controller' },
  { id: '5', name: 'Moradia', color: '#FFA726', icon: 'home' },
  { id: '6', name: 'Educação', color: '#26C6DA', icon: 'school' },
  { id: '7', name: 'Salário', color: '#9CCC65', icon: 'cash' },
  { id: '8', name: 'Investimentos', color: '#8D6E63', icon: 'trending-up' },
]

const DEFAULT_ACCOUNTS: Account[] = [
  { id: '1', name: 'Conta Corrente', balance: 3250.00, type: 'corrente', color: '#42A5F5', icon: 'card' },
  { id: '2', name: 'Poupança', balance: 12000.00, type: 'poupanca', color: '#66BB6A', icon: 'leaf' },
  { id: '3', name: 'Carteira', balance: 150.00, type: 'carteira', color: '#FFA726', icon: 'wallet' },
]

const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    description: 'Salário',
    amount: 5500,
    type: 'receita',
    date: new Date().toISOString(),
    accountId: '1',
    tagIds: ['7'],
    recurrence: 'mensal',
    paid: true,
  },
  {
    id: '2',
    description: 'Aluguel',
    amount: 1800,
    type: 'despesa',
    date: new Date().toISOString(),
    accountId: '1',
    tagIds: ['5'],
    recurrence: 'mensal',
    paid: true,
  },
  {
    id: '3',
    description: 'Supermercado',
    amount: 420,
    type: 'despesa',
    date: new Date().toISOString(),
    accountId: '1',
    tagIds: ['1'],
    recurrence: 'unica',
    paid: true,
  },
]

export function useStore() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState<number>(5000)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [txRaw, accRaw, tagsRaw, budgetRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
        AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
        AsyncStorage.getItem(STORAGE_KEYS.TAGS),
        AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_BUDGET),
      ])
      setTransactions(txRaw ? JSON.parse(txRaw) : DEFAULT_TRANSACTIONS)
      setAccounts(accRaw ? JSON.parse(accRaw) : DEFAULT_ACCOUNTS)
      setTags(tagsRaw ? JSON.parse(tagsRaw) : DEFAULT_TAGS)
      setMonthlyBudget(budgetRaw ? parseFloat(budgetRaw) : 5000)
    } catch (e) {
      setTransactions(DEFAULT_TRANSACTIONS)
      setAccounts(DEFAULT_ACCOUNTS)
      setTags(DEFAULT_TAGS)
    } finally {
      setLoading(false)
    }
  }

  const saveMonthlyBudget = useCallback(async (value: number) => {
    await AsyncStorage.setItem(STORAGE_KEYS.MONTHLY_BUDGET, String(value))
    setMonthlyBudget(value)
  }, [])

  const saveTransactions = useCallback(async (data: Transaction[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data))
    setTransactions(data)
  }, [])

  const saveAccounts = useCallback(async (data: Account[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(data))
    setAccounts(data)
  }, [])

  const saveTags = useCallback(async (data: Tag[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(data))
    setTags(data)
  }, [])

  const addTransaction = useCallback(async (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = { ...tx, id: Date.now().toString() }
    const updated = [newTx, ...transactions]
    await saveTransactions(updated)

    // Update account balance
    const updatedAccounts = accounts.map(acc => {
      if (acc.id === tx.accountId) {
        const delta = tx.type === 'receita' ? tx.amount : -tx.amount
        return { ...acc, balance: acc.balance + (tx.paid ? delta : 0) }
      }
      return acc
    })
    await saveAccounts(updatedAccounts)
    return newTx
  }, [transactions, accounts, saveTransactions, saveAccounts])

  const deleteTransaction = useCallback(async (id: string) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return
    const updated = transactions.filter(t => t.id !== id)
    await saveTransactions(updated)
    // Reverse balance if was paid
    if (tx.paid) {
      const updatedAccounts = accounts.map(acc => {
        if (acc.id === tx.accountId) {
          const delta = tx.type === 'receita' ? -tx.amount : tx.amount
          return { ...acc, balance: acc.balance + delta }
        }
        return acc
      })
      await saveAccounts(updatedAccounts)
    }
  }, [transactions, accounts, saveTransactions, saveAccounts])

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  const monthlyIncome = transactions
    .filter(t => t.type === 'receita' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0)

  const monthlyExpense = transactions
    .filter(t => t.type === 'despesa' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0)

  return {
    transactions,
    accounts,
    tags,
    monthlyBudget,
    saveMonthlyBudget,
    loading,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    addTransaction,
    deleteTransaction,
    saveAccounts,
    saveTags,
  }
}