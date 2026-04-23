// hooks/useStore.ts
import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Transaction, Account, Tag } from '@/constants/types'

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  TAGS: '@horizonte:tags',
  MONTHLY_BUDGET: '@horizonte:monthly_budget',
  SHOW_PENDING: '@horizonte:show_pending',
}

const DEFAULT_TAGS: Tag[] = []
const DEFAULT_ACCOUNTS: Account[] = []
const DEFAULT_TRANSACTIONS: Transaction[] = []

export function useStore() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0)
  const [showPending, setShowPendingState] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [txRaw, accRaw, tagsRaw, budgetRaw, showPendingRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
        AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
        AsyncStorage.getItem(STORAGE_KEYS.TAGS),
        AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_BUDGET),
        AsyncStorage.getItem(STORAGE_KEYS.SHOW_PENDING),
      ])

      setTransactions(txRaw ? JSON.parse(txRaw) : DEFAULT_TRANSACTIONS)
      setAccounts(accRaw ? JSON.parse(accRaw) : DEFAULT_ACCOUNTS)
      setTags(tagsRaw ? JSON.parse(tagsRaw) : DEFAULT_TAGS)
      setMonthlyBudget(budgetRaw ? parseFloat(budgetRaw) : 0)

      if (showPendingRaw !== null) {
        setShowPendingState(JSON.parse(showPendingRaw))
      }
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

  const setShowPending = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(STORAGE_KEYS.SHOW_PENDING, JSON.stringify(value))
    setShowPendingState(value)
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

  const clearAllData = useCallback(async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TRANSACTIONS,
      STORAGE_KEYS.ACCOUNTS,
      STORAGE_KEYS.TAGS,
      STORAGE_KEYS.MONTHLY_BUDGET,
      STORAGE_KEYS.SHOW_PENDING,
    ])
    setTransactions(DEFAULT_TRANSACTIONS)
    setAccounts(DEFAULT_ACCOUNTS)
    setTags(DEFAULT_TAGS)
    setMonthlyBudget(0)
    setShowPendingState(true)
  }, [])

  // 👉 A MÁGICA DO PARCELAMENTO ACONTECE AQUI
  const addTransaction = useCallback(async (tx: any) => {
    const newTransactions: Transaction[] = []
    let updatedAccounts = [...accounts]

    // Descobre se a conta é um Cartão de Crédito
    const targetAccount = updatedAccounts.find(a => a.id === tx.accountId)
    const isCreditCard = targetAccount?.type === 'cartao_credito'

    // Força como 'credito' no sistema
    const finalizedTxMethod = isCreditCard ? 'credito' : (tx.paymentMethod || 'debito')

    // 1. SE FOR CARTÃO E TIVER PARCELAS (> 1)
    if (isCreditCard && tx.totalInstallments && tx.totalInstallments > 1) {
      const baseDate = new Date(tx.date)

      // Divide o valor exato pelas parcelas!
      const installmentAmount = tx.amount / tx.totalInstallments

      for (let i = 0; i < tx.totalInstallments; i++) {
        const currentDate = new Date(baseDate)
        currentDate.setMonth(baseDate.getMonth() + i) // Joga para o próximo mês

        newTransactions.push({
          ...tx,
          id: Date.now().toString() + '-' + i,
          // Adiciona o (1/2), (2/2) no final da descrição automaticamente
          description: `${tx.description} (${i + 1}/${tx.totalInstallments})`,
          amount: installmentAmount, // Salva o valor fracionado (Ex: R$ 50)
          date: currentDate.toISOString(),
          paid: false, // Faturas do futuro não estão pagas ainda
          paymentMethod: finalizedTxMethod,
        })
      }
    }
    // 2. SE FOR CARTÃO À VISTA (1 Parcela)
    else if (isCreditCard && (!tx.totalInstallments || tx.totalInstallments === 1)) {
      const newTx: Transaction = {
        ...tx,
        id: Date.now().toString(),
        paymentMethod: finalizedTxMethod,
        paid: false // Cartão de crédito só é pago quando a fatura fecha
      }
      newTransactions.push(newTx)
    }
    // 3. SE FOR DÉBITO RECORRENTE MENSAL (Ex: Netflix)
    else if (tx.recurrence === 'mensal') {
      const baseDate = new Date(tx.date)
      for (let i = 0; i < 12; i++) {
        const currentDate = new Date(baseDate)
        currentDate.setMonth(baseDate.getMonth() + i)

        const isPaid = i === 0 ? tx.paid : false

        newTransactions.push({
          ...tx,
          id: Date.now().toString() + '-' + i,
          date: currentDate.toISOString(),
          paid: isPaid,
          paymentMethod: finalizedTxMethod,
        })

        if (isPaid) {
          updatedAccounts = updatedAccounts.map(acc => {
            if (acc.id === tx.accountId) {
              const delta = tx.type === 'receita' ? tx.amount : -tx.amount
              return { ...acc, balance: acc.balance + delta }
            }
            return acc
          })
        }
      }
    }
    // 4. SE FOR COMPRA ÚNICA NO DÉBITO OU DINHEIRO
    else {
      const newTx: Transaction = {
        ...tx,
        id: Date.now().toString(),
        paymentMethod: finalizedTxMethod
      }
      newTransactions.push(newTx)

      if (tx.paid) {
        updatedAccounts = updatedAccounts.map(acc => {
          if (acc.id === tx.accountId) {
            const delta = tx.type === 'receita' ? tx.amount : -tx.amount
            return { ...acc, balance: acc.balance + delta }
          }
          return acc
        })
      }
    }

    const updated = [...newTransactions, ...transactions]
    await saveTransactions(updated)
    await saveAccounts(updatedAccounts)

    return newTransactions[0]
  }, [transactions, accounts, saveTransactions, saveAccounts])

  const deleteTransaction = useCallback(async (id: string) => {
    const tx = transactions.find(t => t.id === id)
    if (!tx) return
    const updated = transactions.filter(t => t.id !== id)
    await saveTransactions(updated)

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

  const updateTransaction = useCallback(async (updatedTx: Transaction) => {
    const oldTx = transactions.find(t => t.id === updatedTx.id)
    if (!oldTx) return

    let updatedAccounts = [...accounts]

    if (oldTx.paid) {
      updatedAccounts = updatedAccounts.map(acc => {
        if (acc.id === oldTx.accountId) {
          const delta = oldTx.type === 'receita' ? -oldTx.amount : oldTx.amount
          return { ...acc, balance: acc.balance + delta }
        }
        return acc
      })
    }

    if (updatedTx.paid) {
      updatedAccounts = updatedAccounts.map(acc => {
        if (acc.id === updatedTx.accountId) {
          const delta = updatedTx.type === 'receita' ? updatedTx.amount : -updatedTx.amount
          return { ...acc, balance: acc.balance + delta }
        }
        return acc
      })
    }

    const updatedTransactions = transactions.map(t =>
      t.id === updatedTx.id ? updatedTx : t
    )

    await saveTransactions(updatedTransactions)
    await saveAccounts(updatedAccounts)
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
    showPending,
    setShowPending,
    saveMonthlyBudget,
    loading,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    saveAccounts,
    saveTags,
    clearAllData,
  }
}