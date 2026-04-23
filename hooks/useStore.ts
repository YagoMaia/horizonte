// hooks/useStore.ts
import { useState, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Transaction, Account, Tag } from '@/constants/types'

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  TAGS: '@horizonte:tags',
  MONTHLY_BUDGET: '@horizonte:monthly_budget',
  SHOW_PENDING: '@horizonte:show_pending',
}

export function useStore() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0)
  const [showPending, setShowPendingState] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [txRaw, accRaw, tagsRaw, budgetRaw, showPendingRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
        AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
        AsyncStorage.getItem(STORAGE_KEYS.TAGS),
        AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_BUDGET),
        AsyncStorage.getItem(STORAGE_KEYS.SHOW_PENDING),
      ])
      setTransactions(txRaw ? JSON.parse(txRaw) : [])
      setAccounts(accRaw ? JSON.parse(accRaw) : [])
      setTags(tagsRaw ? JSON.parse(tagsRaw) : [])
      setMonthlyBudget(budgetRaw ? parseFloat(budgetRaw) : 0)
      if (showPendingRaw !== null) setShowPendingState(JSON.parse(showPendingRaw))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const saveTransactions = useCallback(async (data: Transaction[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data))
    setTransactions(data)
  }, [])

  const saveAccounts = useCallback(async (data: Account[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(data))
    setAccounts(data)
  }, [])

  // 👉 CÁLCULO DO SALDO TOTAL (PATRIMÓNIO LÍQUIDO)
  const totalBalance = useMemo(() => {
    // 1. Dinheiro real nas contas (ignora cartões de crédito)
    const cashInHand = accounts
      .filter(a => a.type !== 'cartao_credito')
      .reduce((sum, a) => sum + a.balance, 0);

    // 2. Dívida total acumulada em todos os cartões (transações de crédito não pagas)
    const totalCreditDebt = transactions
      .filter(t => t.paymentMethod === 'credito' && !t.paid)
      .reduce((sum, t) => sum + t.amount, 0);

    return cashInHand - totalCreditDebt;
  }, [accounts, transactions]);

  const addTransaction = useCallback(async (tx: any) => {
    const newTransactions: Transaction[] = []
    let updatedAccounts = [...accounts]
    const targetAccount = updatedAccounts.find(a => a.id === tx.accountId)
    const isCreditCard = targetAccount?.type === 'cartao_credito'
    const finalizedTxMethod = isCreditCard ? 'credito' : (tx.paymentMethod || 'debito')
    const closingDay = targetAccount?.closingDay || 31;

    if (isCreditCard) {
      const baseDate = new Date(tx.date)
      const dayOfPurchase = baseDate.getDate()
      const shiftMonths = dayOfPurchase >= closingDay ? 2 : 1;
      const installmentsCount = tx.totalInstallments || 1;
      const installmentAmount = tx.amount / installmentsCount;
      const baseId = Date.now().toString();

      for (let i = 0; i < installmentsCount; i++) {
        const currentDate = new Date(baseDate)
        currentDate.setDate(1)
        currentDate.setMonth(baseDate.getMonth() + i + shiftMonths)
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
        currentDate.setDate(Math.min(dayOfPurchase, lastDay))

        newTransactions.push({
          ...tx,
          id: `${baseId}-${i}`,
          description: installmentsCount > 1 ? `${tx.description} (${i + 1}/${installmentsCount})` : tx.description,
          amount: installmentAmount,
          date: currentDate.toISOString(),
          paid: false,
          paymentMethod: 'credito',
        })
      }
    } else {
      const newTx = { ...tx, id: Date.now().toString(), paymentMethod: finalizedTxMethod }
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
    let idsToDelete = [id];
    if (id.includes('-')) {
      const baseId = id.split('-')[0];
      idsToDelete = transactions.filter(t => t.id.startsWith(`${baseId}-`)).map(t => t.id);
    }
    const updated = transactions.filter(t => !idsToDelete.includes(t.id))
    await saveTransactions(updated)
    if (tx.paid) {
      const updatedAccounts = accounts.map(acc => {
        if (acc.id === tx.accountId) {
          return { ...acc, balance: acc.balance + (tx.type === 'receita' ? -tx.amount : tx.amount) }
        }
        return acc
      })
      await saveAccounts(updatedAccounts)
    }
  }, [transactions, accounts, saveTransactions, saveAccounts])

  return {
    transactions, accounts, tags, totalBalance, loading, showPending,
    setShowPending: setShowPendingState, addTransaction, deleteTransaction,
    saveAccounts, saveTags: (t: Tag[]) => { setTags(t); AsyncStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(t)) },
    monthlyIncome: transactions.filter(t => t.type === 'receita' && t.paid).reduce((s, t) => s + t.amount, 0),
    monthlyExpense: transactions.filter(t => t.type === 'despesa' && t.paid).reduce((s, t) => s + t.amount, 0),
  }
}