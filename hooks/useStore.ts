// hooks/useStore.ts
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account, Tag, DEFAULT_TAGS } from '@/constants/types';

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  MONTHLY_BUDGETS: '@horizonte:monthly_budgets',
  SHOW_PENDING: '@horizonte:show_pending',
  TAGS: '@horizonte:tags', // 👉 Nova chave
};

const DEFAULT_ACCOUNTS: Account[] = [];
const DEFAULT_TRANSACTIONS: Transaction[] = [];

export function useStore() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS); // 👉 Estado inicial com as tags padrão
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, number>>({});
  const [showPending, setShowPendingState] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  // --- MÉTODOS DE SALVAMENTO ---
  
  const saveTransactions = useCallback(async (data: Transaction[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data));
    setTransactions(data);
  }, []);

  const saveAccounts = useCallback(async (data: Account[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(data));
    setAccounts(data);
  }, []);

  const saveTags = useCallback(async (data: Tag[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(data));
    setTags(data);
  }, []);

  // --- MÉTODOS DE PROCESSAMENTO ---

  const autoProcessOverdueTransactions = useCallback(async (currentTransactions: Transaction[], currentAccounts: Account[]) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); 

    let hasChanges = false;
    let updatedAccounts = [...currentAccounts];
    const updatedTransactions = currentTransactions.map(tx => {
      const txDate = new Date(tx.date);
      const isOverdue = txDate <= today;
      
      const targetAccount = updatedAccounts.find(a => a.id === tx.accountId);
      const isCreditCard = targetAccount?.type === 'cartao_credito';

      if (!tx.paid && !isCreditCard && isOverdue) {
        hasChanges = true;
        
        updatedAccounts = updatedAccounts.map(acc => {
          if (acc.id === tx.accountId) {
            const delta = tx.type === 'receita' ? tx.amount : -tx.amount;
            return { ...acc, balance: acc.balance + delta };
          }
          if (tx.type === 'transferencia' && acc.id === tx.targetAccountId) {
            return { ...acc, balance: acc.balance + tx.amount };
          }
          return acc;
        });

        return { ...tx, paid: true };
      }
      return tx;
    });

    if (hasChanges) {
      await saveTransactions(updatedTransactions);
      await saveAccounts(updatedAccounts);
    }
  }, [saveTransactions, saveAccounts]);

  const loadData = useCallback(async () => {
    try {
      const [txRaw, accRaw, budgetsRaw, showPendingRaw, tagsRaw] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_BUDGETS),
          AsyncStorage.getItem(STORAGE_KEYS.SHOW_PENDING),
          AsyncStorage.getItem(STORAGE_KEYS.TAGS),
        ]);

      const loadedTransactions = txRaw ? JSON.parse(txRaw) : DEFAULT_TRANSACTIONS;
      const loadedAccounts = accRaw ? JSON.parse(accRaw) : DEFAULT_ACCOUNTS;
      const loadedTags = tagsRaw ? JSON.parse(tagsRaw) : DEFAULT_TAGS;

      setTransactions(loadedTransactions);
      setAccounts(loadedAccounts);
      setTags(loadedTags);
      setMonthlyBudgets(budgetsRaw ? JSON.parse(budgetsRaw) : {});

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

  // --- DEMAIS MÉTODOS ---

  const setShowPending = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SHOW_PENDING,
      JSON.stringify(value),
    );
    setShowPendingState(value);
  }, []);

  const clearAllData = useCallback(async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TRANSACTIONS,
      STORAGE_KEYS.ACCOUNTS,
      STORAGE_KEYS.MONTHLY_BUDGETS,
      STORAGE_KEYS.SHOW_PENDING,
      STORAGE_KEYS.TAGS,
    ]);
    setTransactions(DEFAULT_TRANSACTIONS);
    setAccounts(DEFAULT_ACCOUNTS);
    setTags(DEFAULT_TAGS);
    setMonthlyBudgets({});
    setShowPendingState(true);
  }, []);

  const addTag = useCallback(async (tag: Omit<Tag, 'id'>) => {
    const newTag: Tag = { ...tag, id: Date.now().toString() };
    const updated = [...tags, newTag];
    await saveTags(updated);
  }, [tags, saveTags]);

  const updateTag = useCallback(async (updatedTag: Tag) => {
    const updated = tags.map(t => t.id === updatedTag.id ? updatedTag : t);
    await saveTags(updated);
  }, [tags, saveTags]);

  const deleteTag = useCallback(async (id: string) => {
    const updated = tags.filter(t => t.id !== id);
    await saveTags(updated);
  }, [tags, saveTags]);

  const addTransaction = useCallback(
    async (tx: any) => {
      const newTransactions: Transaction[] = [];
      let updatedAccounts = [...accounts];

      const targetAccount = updatedAccounts.find((a) => a.id === tx.accountId);
      const isCreditCard = targetAccount?.type === 'cartao_credito';
      const finalizedTxMethod = isCreditCard
        ? 'credito'
        : tx.paymentMethod || 'debito';

      const closingDay = targetAccount?.closingDay || 25;
      const dueDay = targetAccount?.dueDay || 5;

      if (isCreditCard) {
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
            let targetInvM = baseM + i;
            let monthForDay1 = targetInvM - (dueDay < closingDay ? 1 : 0);

            currentDate = new Date(baseY, monthForDay1 - 1, 1, 12, 0, 0);
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
            const targetMonth = baseDate.getMonth() + i;
            const targetYear = baseDate.getFullYear();
            
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

          const isPaid = i === 0 ? tx.paid : false;

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
        const newTx: Transaction = {
          ...tx,
          id: Date.now().toString(),
          paymentMethod: finalizedTxMethod,
        };
        newTransactions.push(newTx);

        if (tx.paid) {
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
      await saveTransactions(updated);
      await saveAccounts(updatedAccounts);
      return newTransactions[0];
    },
    [transactions, accounts, saveTransactions, saveAccounts],
  );

  const deleteTransaction = useCallback(
    async (id: string, mode: 'single' | 'future' | 'all' = 'single') => {
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

      await saveTransactions(updated);
      await saveAccounts(updatedAccounts);
    },
    [transactions, accounts, saveTransactions, saveAccounts],
  );

  const updateTransaction = useCallback(
    async (
      updatedTx: Transaction,
      mode: 'single' | 'future' | 'all' = 'single',
    ) => {
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
        if (!tx.paid) return;
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
        
        // Determina a data base real (do index 0) para não deslocar todas as faturas se editar um index > 0
        const originalBaseTx = familyTxs.find(t => t.groupIndex === 0) || familyTxs[0];
        const effectiveBaseDate = oldTx.groupIndex === 0 ? newDateBase : new Date(originalBaseTx.date);

        const cleanDescription = updatedTx.description.replace(/\s\(\d+\/\d+\)$/, "");

        txsToMutate.forEach((mutantOld) => {
          revertBalance(mutantOld);
          let newMutantDate = new Date(mutantOld.date);

          if (isCreditCard && mutantOld.groupIndex !== undefined) {
            if (mutantOld.groupIndex === 0) {
              newMutantDate = new Date(effectiveBaseDate);
            } else {
              let baseM = effectiveBaseDate.getMonth() + 1;
              let baseY = effectiveBaseDate.getFullYear();
              if (effectiveBaseDate.getDate() >= closingDay) baseM += 1;
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
            ...updatedTx, // Puxa todos os campos novos (amount, tag, notas, etc)
            id: mutantOld.id, // Preserva o ID antigo
            groupId: mutantOld.groupId,
            groupIndex: mutantOld.groupIndex,
            date: newMutantDate.toISOString(),
            description: `${cleanDescription}${oldSuffix}`,
            paid: mutantOld.paid, // Preserva o status de pagamento original (futuros pendentes)
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

      await saveTransactions(finalTransactions);
      await saveAccounts(updatedAccounts);
    },
    [transactions, accounts, saveTransactions, saveAccounts],
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

  const totalBalance = accounts.reduce((sum, a) => {
    if (a.type === 'cartao_credito') {
      return sum;
    }
    return sum + a.balance;
  }, 0);

  const monthlyIncome = transactions
    .filter((t) => t.type === 'receita' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpense = transactions
    .filter((t) => t.type === 'despesa' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0);

  const payCreditCardInvoice = useCallback(
    async (
      creditCardId: string,
      sourceAccountId: string,
      targetMonth: number,
      targetYear: number,
    ) => {
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

      await saveTransactions(finalTransactions);
      await saveAccounts(updatedAccounts);
    },
    [transactions, accounts, saveTransactions, saveAccounts],
  );

  const anticipateCreditCardPayment = useCallback(
    async (
      creditCardId: string,
      sourceAccountId: string,
      amount: number,
      targetMonth: number,
      targetYear: number,
    ) => {
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

      await saveTransactions(finalTransactions);
      await saveAccounts(updatedAccounts);
    },
    [transactions, accounts, saveTransactions, saveAccounts]
  );

  const deleteMultipleTransactions = useCallback(
    async (txIds: string[]) => {
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

      await saveTransactions(updated);
      await saveAccounts(updatedAccounts);
    },
    [transactions, accounts, saveTransactions, saveAccounts],
  );

  return {
    transactions,
    accounts,
    tags, // 👉 Exportando tags
    addTag, // 👉 Exportando métodos de tag
    updateTag,
    deleteTag,
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
  };
}
