// hooks/useStore.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account, RecurringExpense, BudgetAllocation, RecurringExpenseCategory } from '@/constants/types';
import { buildTransactionIndexes } from '@/lib/transactionIndexes';
import { 
  scheduleTransactionNotification, 
  scheduleCardClosingNotification, 
  scheduleCardDueNotification,
  cancelAllNotifications,
  registerForPushNotificationsAsync
} from '@/lib/notifications';

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  MONTHLY_BUDGETS: '@horizonte:monthly_budgets',
  SHOW_PENDING: '@horizonte:show_pending',
  RECURRING_EXPENSES: '@horizonte:recurring_expenses',
  BUDGET_ALLOCATION: '@horizonte:budget_allocation',
  RECURRING_OVERRIDES: '@horizonte:recurring_overrides', // categorias dos itens auto-detectados
};

const DEFAULT_BUDGET_ALLOCATION: BudgetAllocation = {
  investimento: 50,
  fixo: 25,
  variavel: 15,
  outros: 10,
};

export function useStore() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, number>>({});
  const [showPending, setShowPendingState] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [budgetAllocation, setBudgetAllocationState] = useState<BudgetAllocation>(DEFAULT_BUDGET_ALLOCATION);
  // Record<groupId, categoria> — sobrescreve a classificação automática
  const [recurringOverrides, setRecurringOverrides] = useState<Record<string, RecurringExpenseCategory>>({});

  // Mutex para serializar operações de escrita e evitar race conditions
  const writeLock = useRef<Promise<void>>(Promise.resolve());

  const withWriteLock = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const currentLock = writeLock.current;
    let resolve: () => void;
    writeLock.current = new Promise<void>((r) => { resolve = r; });
    return currentLock.then(fn).finally(() => resolve!());
  }, []);

  // --- MÉTODOS DE SALVAMENTO (Devem vir antes de serem usados em outros callbacks) ---
  
  const saveTransactions = useCallback(async (data: Transaction[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data));
      setTransactions(data);
    } catch (e) {
      console.error('Erro ao salvar transações:', e);
      throw e;
    }
  }, []);

  const saveAccounts = useCallback(async (data: Account[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(data));
      setAccounts(data);
    } catch (e) {
      console.error('Erro ao salvar contas:', e);
      throw e;
    }
  }, []);

  // Escrita atômica: salva transações e contas juntas para evitar inconsistência
  const saveTransactionsAndAccounts = useCallback(async (txData: Transaction[], accData: Account[]) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txData)],
        [STORAGE_KEYS.ACCOUNTS, JSON.stringify(accData)],
      ]);
      setTransactions(txData);
      setAccounts(accData);
    } catch (e) {
      console.error('Erro ao salvar dados:', e);
      throw e;
    }
  }, []);

  // --- MÉTODOS DE PROCESSAMENTO ---

  const autoProcessOverdueTransactions = useCallback(async (currentTransactions: Transaction[], currentAccounts: Account[]) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); 

    let hasChanges = false;
    
    // Converte para Record (Dicionário) para busca e atualização O(1)
    const accountsMap: Record<string, Account> = {};
    for (const acc of currentAccounts) {
      accountsMap[acc.id] = { ...acc };
    }

    const updatedTransactions = currentTransactions.map(tx => {
      const txDate = new Date(tx.date);
      const isOverdue = txDate <= today;
      
      const targetAccount = accountsMap[tx.accountId];
      const isCreditCard = targetAccount?.type === 'cartao_credito';

      if (!tx.paid && !isCreditCard && isOverdue) {
        if (tx.reminderEnabled) {
          return tx;
        }
        hasChanges = true;
        
        if (targetAccount) {
          const delta = tx.type === 'receita' ? tx.amount : -tx.amount;
          targetAccount.balance += delta;
        }
        
        if (tx.type === 'transferencia' && tx.targetAccountId && accountsMap[tx.targetAccountId]) {
          accountsMap[tx.targetAccountId].balance += tx.amount;
        }

        return { ...tx, paid: true };
      }
      return tx;
    });

    if (hasChanges) {
      const updatedAccounts = Object.values(accountsMap);
      await saveTransactionsAndAccounts(updatedTransactions, updatedAccounts);
    }
  }, [saveTransactionsAndAccounts]);

  const loadData = useCallback(async () => {
    try {
      const [txRaw, accRaw, budgetsRaw, showPendingRaw, recurringExpensesRaw, budgetAllocationRaw, overridesRaw] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_BUDGETS),
          AsyncStorage.getItem(STORAGE_KEYS.SHOW_PENDING),
          AsyncStorage.getItem(STORAGE_KEYS.RECURRING_EXPENSES),
          AsyncStorage.getItem(STORAGE_KEYS.BUDGET_ALLOCATION),
          AsyncStorage.getItem(STORAGE_KEYS.RECURRING_OVERRIDES),
        ]);

      const loadedTransactions = txRaw ? JSON.parse(txRaw) : [];
      const loadedAccounts = accRaw ? JSON.parse(accRaw) : [];

      setTransactions(loadedTransactions);
      setAccounts(loadedAccounts);
      setMonthlyBudgets(budgetsRaw ? JSON.parse(budgetsRaw) : {});
      setRecurringExpenses(recurringExpensesRaw ? JSON.parse(recurringExpensesRaw) : []);
      setBudgetAllocationState(budgetAllocationRaw ? JSON.parse(budgetAllocationRaw) : DEFAULT_BUDGET_ALLOCATION);
      setRecurringOverrides(overridesRaw ? JSON.parse(overridesRaw) : {});

      if (showPendingRaw !== null) {
        setShowPendingState(JSON.parse(showPendingRaw));
      }

      await autoProcessOverdueTransactions(loadedTransactions, loadedAccounts);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  }, [autoProcessOverdueTransactions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const initNotifications = async () => {
      await registerForPushNotificationsAsync();
      
      // Cancela todas as notificações existentes antes de reagendar
      // para evitar duplicatas após mudanças de estado
      await cancelAllNotifications();
      
      // Schedule card reminders
      accounts.forEach(acc => {
        if (acc.type === 'cartao_credito') {
          scheduleCardClosingNotification(acc);
          scheduleCardDueNotification(acc);
        }
      });

      // Also ensure existing transactions with reminders are scheduled
      transactions.forEach(tx => {
        if (tx.reminderEnabled && !tx.paid) {
          scheduleTransactionNotification(tx);
        }
      });
    };

    if (!loading) {
      initNotifications();
    }
  }, [loading, accounts.length, transactions.length]);

  // --- DEMAIS MÉTODOS ---

  const setShowPending = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SHOW_PENDING,
      JSON.stringify(value),
    );
    setShowPendingState(value);
  }, []);

  const clearAllData = useCallback(async () => {
    await cancelAllNotifications();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TRANSACTIONS,
      STORAGE_KEYS.ACCOUNTS,
      STORAGE_KEYS.MONTHLY_BUDGETS,
      STORAGE_KEYS.SHOW_PENDING,
      STORAGE_KEYS.RECURRING_EXPENSES,
      STORAGE_KEYS.BUDGET_ALLOCATION,
      STORAGE_KEYS.RECURRING_OVERRIDES,
    ]);
    setTransactions([]);
    setAccounts([]);
    setMonthlyBudgets({});
    setShowPendingState(true);
    setRecurringExpenses([]);
    setBudgetAllocationState(DEFAULT_BUDGET_ALLOCATION);
    setRecurringOverrides({});
  }, []);

  // --- CRUD: GASTOS RECORRENTES ---

  const saveRecurringExpenses = useCallback(async (data: RecurringExpense[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.RECURRING_EXPENSES, JSON.stringify(data));
    setRecurringExpenses(data);
  }, []);

  const addRecurringExpense = useCallback(async (expense: Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newExpense: RecurringExpense = {
      ...expense,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...recurringExpenses, newExpense];
    await saveRecurringExpenses(updated);
    return newExpense;
  }, [recurringExpenses, saveRecurringExpenses]);

  const updateRecurringExpense = useCallback(async (expense: RecurringExpense) => {
    const updated = recurringExpenses.map((e) =>
      e.id === expense.id ? { ...expense, updatedAt: new Date().toISOString() } : e
    );
    await saveRecurringExpenses(updated);
  }, [recurringExpenses, saveRecurringExpenses]);

  const deleteRecurringExpense = useCallback(async (id: string) => {
    const updated = recurringExpenses.filter((e) => e.id !== id);
    await saveRecurringExpenses(updated);
  }, [recurringExpenses, saveRecurringExpenses]);

  // --- ALOCAÇÃO ORÇAMENTÁRIA ---

  const saveBudgetAllocation = useCallback(async (allocation: BudgetAllocation) => {
    await AsyncStorage.setItem(STORAGE_KEYS.BUDGET_ALLOCATION, JSON.stringify(allocation));
    setBudgetAllocationState(allocation);
  }, []);

  // --- OVERRIDE DE CATEGORIA DE RECORRÊNCIA AUTO-DETECTADA ---

  const saveRecurringOverride = useCallback(async (groupId: string, category: RecurringExpenseCategory) => {
    const updated = { ...recurringOverrides, [groupId]: category };
    await AsyncStorage.setItem(STORAGE_KEYS.RECURRING_OVERRIDES, JSON.stringify(updated));
    setRecurringOverrides(updated);
  }, [recurringOverrides]);

  const addTransaction = useCallback(
    (tx: any) => withWriteLock(async () => {
      const newTransactions: Transaction[] = [];
      let updatedAccounts = [...accounts];

      const targetAccount = updatedAccounts.find((a) => a.id === tx.accountId);
      const isCreditCard = targetAccount?.type === 'cartao_credito';
      const finalizedTxMethod = isCreditCard
        ? 'credito'
        : tx.paymentMethod || 'debito';

      const closingDay = targetAccount?.closingDay || 25;
      const dueDay = targetAccount?.dueDay || 5;

      if (isCreditCard && (!tx.recurrence || tx.recurrence === 'unica')) {
        const baseDate = new Date(tx.date);

        const installmentsCount =
          tx.totalInstallments && tx.totalInstallments > 1
            ? tx.totalInstallments
            : 1;
        const installmentAmount = tx.amount / installmentsCount;
        const baseId = Date.now().toString();

        const cleanDescription = tx.description.replace(/\s\(\d+\/\d+\)$/, "");

        let baseM = baseDate.getMonth() + 1;
        let baseY = baseDate.getFullYear();
        if (baseDate.getDate() >= closingDay) baseM += 1;
        if (dueDay < closingDay) baseM += 1;

        for (let i = 0; i < installmentsCount; i++) {
          let currentDate: Date;

          if (i === 0) {
            currentDate = new Date(baseDate);
          } else {
            // Mantém o mesmo dia da compra original, avançando meses
            // Isso garante que cada parcela caia na fatura correta baseado no closingDay
            const purchaseDay = baseDate.getDate();
            let targetInvM = baseM + i;
            let monthForDate = targetInvM - (dueDay < closingDay ? 1 : 0) - (baseDate.getDate() >= closingDay ? 1 : 0);

            // Calcula o ano e mês corretos considerando overflow
            let targetYear = baseY + Math.floor((monthForDate - 1) / 12);
            let targetMonth = ((monthForDate - 1) % 12 + 12) % 12;

            // Garante que o dia não exceda o máximo do mês alvo
            const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
            const safeDay = Math.min(purchaseDay, maxDay);

            currentDate = new Date(targetYear, targetMonth, safeDay, 12, 0, 0);
          }

          const descSuffix = installmentsCount > 1 ? ` (${i + 1}/${installmentsCount})` : '';

          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`,
            groupId: baseId,
            groupIndex: i,
            description: `${cleanDescription}${descSuffix}`,
            amount: installmentAmount,
            date: currentDate.toISOString(),
            paid: false,
            paymentMethod: finalizedTxMethod,
            recurrence: 'unica',
          });
        }
      }
      else if (tx.recurrence === 'mensal' || tx.recurrence === 'anual' || tx.recurrence === 'semanal' || tx.recurrence === 'diaria' || tx.recurrence === 'quinto_dia_util') {
        const baseId = Date.now().toString();
        const baseDate = new Date(tx.date);

        const maxRecurrences = tx.calculatedRecurrenceCount || 24;
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        for (let i = 0; i < maxRecurrences; i++) {
          let currentDate = new Date(baseDate);

          if (tx.recurrence === 'mensal') {
            currentDate.setMonth(baseDate.getMonth() + i);
          } else if (tx.recurrence === 'anual') {
            currentDate.setFullYear(baseDate.getFullYear() + i);
          } else if (tx.recurrence === 'semanal') {
            currentDate.setDate(baseDate.getDate() + (i * 7));
          } else if (tx.recurrence === 'diaria') {
            currentDate.setDate(baseDate.getDate() + i);
          } else if (tx.recurrence === 'quinto_dia_util') {
            // Calcula mês/ano corretamente para recorrências que cruzam virada de ano
            const totalMonths = baseDate.getMonth() + i;
            const targetYear = baseDate.getFullYear() + Math.floor(totalMonths / 12);
            const targetMonth = totalMonths % 12;
            
            let businessDaysCount = 0;
            let day = 1;
            while (businessDaysCount < 5) {
              const d = new Date(targetYear, targetMonth, day);
              const dayOfWeek = d.getDay();
              if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
                businessDaysCount++;
              }
              if (businessDaysCount < 5) day++;
            }
            currentDate = new Date(targetYear, targetMonth, day, 12, 0, 0);
          }

          const isFuture = currentDate > today;
          const isPaid = (i === 0 ? tx.paid : false) && !isFuture;

          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`,
            groupId: baseId,
            groupIndex: i,
            date: currentDate.toISOString(),
            paid: isPaid,
            paymentMethod: finalizedTxMethod,
          });

          if (isPaid) {
            updatedAccounts = updatedAccounts.map((acc) => {
              if (acc.id === tx.accountId) {
                const delta = tx.type === 'receita' ? tx.amount : -tx.amount;
                return { ...acc, balance: acc.balance + delta };
              }
              return acc;
            });
          }
        }
      }
      else {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const txDate = new Date(tx.date);
        const isFuture = txDate > today;
        const finalizedPaid = tx.paid && !isFuture;

        const newTx: Transaction = {
          ...tx,
          id: Date.now().toString(),
          paymentMethod: finalizedTxMethod,
          paid: finalizedPaid,
        };
        newTransactions.push(newTx);

        if (finalizedPaid) {
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === tx.accountId) {
              const delta = tx.type === 'receita' ? tx.amount : -tx.amount;
              return { ...acc, balance: acc.balance + delta };
            }
            if (tx.type === 'transferencia' && acc.id === tx.targetAccountId) {
              return { ...acc, balance: acc.balance + tx.amount };
            }
            return acc;
          });
        }
      }

      const updated = [...newTransactions, ...transactions];
      await saveTransactionsAndAccounts(updated, updatedAccounts);

      // Schedule notifications for new transactions
      newTransactions.forEach(nt => {
        if (nt.reminderEnabled && !nt.paid) {
          scheduleTransactionNotification(nt);
        }
      });

      return newTransactions[0];
    }),
    [transactions, accounts, saveTransactionsAndAccounts, withWriteLock],
  );

  const deleteTransaction = useCallback(
    (id: string, mode: 'single' | 'future' | 'all' = 'single') => withWriteLock(async () => {
      const targetTx = transactions.find((t) => t.id === id);
      if (!targetTx) return;

      let idsToDelete = [id];
      const isPartOfFamily = targetTx.groupId || id.includes('-');

      if (isPartOfFamily && mode !== 'single') {
        const baseId = targetTx.groupId || id.split('-')[0];

        const familyTxs = transactions.filter(
          (t) => t.groupId === baseId || t.id.startsWith(`${baseId}-`),
        );

        if (mode === 'all') {
          idsToDelete = familyTxs.map((t) => t.id);
        } else if (mode === 'future') {
          const targetTime = new Date(targetTx.date).getTime();
          const futureTxs = familyTxs.filter(
            (t) => new Date(t.date).getTime() >= targetTime,
          );
          idsToDelete = futureTxs.map((t) => t.id);
        }
      }

      const updated = transactions.filter((t) => !idsToDelete.includes(t.id));
      let updatedAccounts = [...accounts];
      const txsToDelete = transactions.filter((t) =>
        idsToDelete.includes(t.id),
      );

      txsToDelete.forEach((deletedTx) => {
        if (deletedTx.paid) {
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === deletedTx.accountId) {
              const delta =
                deletedTx.type === 'receita'
                  ? -deletedTx.amount
                  : deletedTx.amount;
              return { ...acc, balance: acc.balance + delta };
            }
            if (
              deletedTx.type === 'transferencia' &&
              acc.id === deletedTx.targetAccountId
            ) {
              return { ...acc, balance: acc.balance - deletedTx.amount };
            }
            return acc;
          });
        }
      });

      await saveTransactionsAndAccounts(updated, updatedAccounts);
    }),
    [transactions, accounts, saveTransactionsAndAccounts, withWriteLock],
  );

  const updateTransaction = useCallback(
    (
      updatedTx: Transaction,
      mode: 'single' | 'future' | 'all' = 'single',
    ) => withWriteLock(async () => {
      const oldTx = transactions.find((t) => t.id === updatedTx.id);
      if (!oldTx) return;

      let updatedAccounts = [...accounts];

      const targetAccount = accounts.find((a) => a.id === updatedTx.accountId);
      const isCreditCard = targetAccount?.type === 'cartao_credito';
      const closingDay = targetAccount?.closingDay || 25;
      const dueDay = targetAccount?.dueDay || 5;

      const revertBalance = (tx: Transaction) => {
        if (!tx.paid) return;
        updatedAccounts = updatedAccounts.map((acc) => {
          if (acc.id === tx.accountId) {
            const delta = tx.type === 'receita' ? -tx.amount : tx.amount;
            return { ...acc, balance: acc.balance + delta };
          }
          if (tx.type === 'transferencia' && acc.id === tx.targetAccountId) {
            return { ...acc, balance: acc.balance - tx.amount };
          }
          return acc;
        });
      };

      const applyBalance = (tx: Transaction) => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const txDate = new Date(tx.date);
        if (!tx.paid || txDate > today) return;
        
        updatedAccounts = updatedAccounts.map((acc) => {
          if (acc.id === tx.accountId) {
            const delta = tx.type === 'receita' ? tx.amount : -tx.amount;
            return { ...acc, balance: acc.balance + delta };
          }
          if (tx.type === 'transferencia' && acc.id === tx.targetAccountId) {
            return { ...acc, balance: acc.balance + tx.amount };
          }
          return acc;
        });
      };

      let finalTransactions = [...transactions];
      const isPartOfFamily = oldTx.groupId || oldTx.id.includes('-');

      if (isPartOfFamily && mode !== 'single') {
        const baseId = oldTx.groupId || oldTx.id.split('-')[0];
        const familyTxs = transactions.filter(
          (t) => t.groupId === baseId || t.id.startsWith(`${baseId}-`),
        );
        const targetTime = new Date(oldTx.date).getTime();

        const txsToMutate =
          mode === 'all'
            ? familyTxs
            : familyTxs.filter((t) => new Date(t.date).getTime() >= targetTime);

        const oldDate = new Date(oldTx.date);
        const newDateBase = new Date(updatedTx.date);

        const cleanDescription = updatedTx.description.replace(/\s\(\d+\/\d+\)$/, "");

        txsToMutate.forEach((mutantOld) => {
          revertBalance(mutantOld);
          let newMutantDate = new Date(mutantOld.date);

          if (isCreditCard && mutantOld.groupIndex !== undefined) {
            if (mutantOld.groupIndex === 0) {
              newMutantDate = new Date(newDateBase);
            } else {
              let baseM = newDateBase.getMonth() + 1;
              let baseY = newDateBase.getFullYear();
              if (newDateBase.getDate() >= closingDay) baseM += 1;
              if (dueDay < closingDay) baseM += 1;

              let targetInvM = baseM + mutantOld.groupIndex;
              let monthForDay1 = targetInvM - (dueDay < closingDay ? 1 : 0);
              newMutantDate = new Date(baseY, monthForDay1 - 1, 1, 12, 0, 0);
            }
          } else {
            if (oldDate.getDate() !== newDateBase.getDate()) {
              newMutantDate.setDate(newDateBase.getDate());
            }
          }

          const oldSuffixMatch = mutantOld.description.match(/\s\(\d+\/\d+\)$/);
          const oldSuffix = oldSuffixMatch ? oldSuffixMatch[0] : '';

          const mutantNew: Transaction = {
            ...mutantOld,
            amount: updatedTx.amount,
            description: `${cleanDescription}${oldSuffix}`,
            accountId: updatedTx.accountId,
            type: updatedTx.type,
            date: newMutantDate.toISOString(),
          };

          applyBalance(mutantNew);

          finalTransactions = finalTransactions.map((t) =>
            t.id === mutantNew.id ? mutantNew : t,
          );
        });
      } else {
        revertBalance(oldTx);
        applyBalance(updatedTx);

        const detachedTx = { ...updatedTx, groupId: undefined };
        finalTransactions = finalTransactions.map((t) =>
          t.id === updatedTx.id ? detachedTx : t,
        );
      }

      await saveTransactionsAndAccounts(finalTransactions, updatedAccounts);

      // Re-schedule notification
      if (updatedTx.reminderEnabled && !updatedTx.paid) {
        scheduleTransactionNotification(updatedTx);
      }
    }),
    [transactions, accounts, saveTransactionsAndAccounts, withWriteLock],
  );

  const getEffectiveBudget = useCallback(
    (year: number, month: number) => {
      const currentKey = `${year}-${String(month).padStart(2, '0')}`;
      if (monthlyBudgets[currentKey]) return monthlyBudgets[currentKey];

      const sortedKeys = Object.keys(monthlyBudgets).sort().reverse();
      for (const key of sortedKeys) {
        if (key < currentKey) return monthlyBudgets[key];
      }

      return 0;
    },
    [monthlyBudgets],
  );

  const saveMonthlyBudget = useCallback(
    async (year: number, month: number, value: number) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const updatedBudgets = { ...monthlyBudgets, [key]: value };

      setMonthlyBudgets(updatedBudgets);
      await AsyncStorage.setItem(
        STORAGE_KEYS.MONTHLY_BUDGETS,
        JSON.stringify(updatedBudgets),
      );
    },
    [monthlyBudgets],
  );

  const totalBalance = useMemo(() => accounts.reduce((sum, a) => {
    if (a.type === 'cartao_credito') {
      return sum;
    }
    return sum + a.balance;
  }, 0), [accounts]);

  const { monthlyIncome, monthlyExpense } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonthPrefix = `${year}-${month}`;

    let income = 0;
    let expense = 0;

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t.paid || !t.date || !t.date.startsWith(currentMonthPrefix)) continue;
      if (t.type === 'receita') {
        income += t.amount;
      } else if (t.type === 'despesa') {
        expense += t.amount;
      }
    }

    return { monthlyIncome: income, monthlyExpense: expense };
  }, [transactions]);

  const transactionIndexes = useMemo(
    () => buildTransactionIndexes(transactions),
    [transactions],
  );

  const payCreditCardInvoice = useCallback(
    (
      creditCardId: string,
      sourceAccountId: string,
      targetMonth: number,
      targetYear: number,
    ) => withWriteLock(async () => {
      const cardAccount = accounts.find((a) => a.id === creditCardId);
      if (!cardAccount || cardAccount.type !== 'cartao_credito') return;

      const invoiceTxs = transactions.filter((tx) => {
        if (
          tx.accountId !== creditCardId ||
          tx.paymentMethod !== 'credito' ||
          tx.paid
        )
          return false;

        const closingDay = cardAccount.closingDay || 25;
        const dueDay = cardAccount.dueDay || 5;
        const d = new Date(tx.date);

        let m = d.getMonth() + 1;
        let y = d.getFullYear();

        if (d.getDate() >= closingDay) m += 1;
        if (dueDay < closingDay) m += 1;

        while (m > 12) {
          m -= 12;
          y += 1;
        }

        return (m - 1) === targetMonth && y === targetYear;
      });

      if (invoiceTxs.length === 0) return;

      const invoiceTotal = invoiceTxs.reduce(
        (sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount),
        0,
      );

      const invoiceTxIds = invoiceTxs.map((t) => t.id);
      const updatedTransactions = transactions.map((tx) => {
        if (invoiceTxIds.includes(tx.id)) {
          return { ...tx, paid: true };
        }
        return tx;
      });

      const paymentTx: Transaction = {
        id: Date.now().toString(),
        description: `Pagamento Fatura - ${cardAccount.name}`,
        amount: invoiceTotal,
        type: 'despesa',
        date: new Date().toISOString(),
        accountId: sourceAccountId,
        paymentMethod: 'debito',
        paid: true,
        recurrence: 'unica',
      };

      const finalTransactions = [paymentTx, ...updatedTransactions];

      const updatedAccounts = accounts.map((acc) => {
        if (acc.id === sourceAccountId) {
          return { ...acc, balance: acc.balance - invoiceTotal };
        }
        return acc;
      });

      await saveTransactionsAndAccounts(finalTransactions, updatedAccounts);
    }),
    [transactions, accounts, saveTransactionsAndAccounts, withWriteLock],
  );

  const anticipateCreditCardPayment = useCallback(
    (
      creditCardId: string,
      sourceAccountId: string,
      amount: number,
      targetMonth: number,
      targetYear: number,
    ) => withWriteLock(async () => {
      const cardAccount = accounts.find((a) => a.id === creditCardId);
      if (!cardAccount) return;

      const baseId = Date.now().toString();

      const paymentTx: Transaction = {
        id: `${baseId}-out`,
        description: `Antecipação - ${cardAccount.name}`,
        amount: amount,
        type: 'despesa',
        date: new Date().toISOString(),
        accountId: sourceAccountId,
        paymentMethod: 'debito',
        paid: true, 
        recurrence: 'unica',
      };

      const closingDay = cardAccount.closingDay || 25;
      const dueDay = cardAccount.dueDay || 5;
      
      const monthOffset = (dueDay < closingDay ? 1 : 0);
      const creditTxDate = new Date(targetYear, targetMonth - monthOffset, 1, 12, 0, 0);

      const creditTx: Transaction = {
        id: `${baseId}-in`,
        description: `Pagamento Antecipado`,
        amount: amount,
        type: 'receita',
        date: creditTxDate.toISOString(), 
        accountId: creditCardId,
        paymentMethod: 'credito',
        paid: false, 
        recurrence: 'unica',
      };

      const finalTransactions = [paymentTx, creditTx, ...transactions];

      const updatedAccounts = accounts.map((acc) => {
        if (acc.id === sourceAccountId) {
          return { ...acc, balance: acc.balance - amount };
        }
        return acc;
      });

      await saveTransactionsAndAccounts(finalTransactions, updatedAccounts);
    }),
    [transactions, accounts, saveTransactionsAndAccounts, withWriteLock]
  );

  const deleteMultipleTransactions = useCallback(
    (txIds: string[]) => withWriteLock(async () => {
      let idsToRemove = new Set<string>();

      txIds.forEach((id) => {
        const targetTx = transactions.find((t) => t.id === id);
        if (!targetTx) return;

        idsToRemove.add(id);
        const isPartOfFamily = targetTx.groupId || id.includes('-');

        if (isPartOfFamily) {
          const baseId = targetTx.groupId || id.split('-')[0];
          const familyTxs = transactions.filter(
            (t) => t.groupId === baseId || t.id.startsWith(`${baseId}-`)
          );
          familyTxs.forEach((t) => idsToRemove.add(t.id));
        }
      });

      const finalIdsToRemove = Array.from(idsToRemove);

      const updated = transactions.filter((t) => !finalIdsToRemove.includes(t.id));
      let updatedAccounts = [...accounts];
      const txsToDelete = transactions.filter((t) => finalIdsToRemove.includes(t.id));

      txsToDelete.forEach((deletedTx) => {
        if (deletedTx.paid) {
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === deletedTx.accountId) {
              const delta = deletedTx.type === 'receita' ? -deletedTx.amount : deletedTx.amount;
              return { ...acc, balance: acc.balance + delta };
            }
            if (deletedTx.type === 'transferencia' && acc.id === deletedTx.targetAccountId) {
              return { ...acc, balance: acc.balance - deletedTx.amount };
            }
            return acc;
          });
        }
      });

      await saveTransactionsAndAccounts(updated, updatedAccounts);
    }),
    [transactions, accounts, saveTransactionsAndAccounts, withWriteLock],
  );

  return {
    transactions,
    transactionIndexes,
    accounts,
    monthlyBudgets,
    getEffectiveBudget,
    saveMonthlyBudget,
    showPending,
    setShowPending,
    loading,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    saveAccounts,
    clearAllData,
    payCreditCardInvoice,
    anticipateCreditCardPayment,
    deleteMultipleTransactions,
    // Orçamento
    recurringExpenses,
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    budgetAllocation,
    saveBudgetAllocation,
    recurringOverrides,
    saveRecurringOverride,
  };
}
