// hooks/useStore.ts
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account, Tag } from '@/constants/types';

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  TAGS: '@horizonte:tags',
  MONTHLY_BUDGETS: '@horizonte:monthly_budgets',
  SHOW_PENDING: '@horizonte:show_pending',
};

const DEFAULT_TAGS: Tag[] = [];
const DEFAULT_ACCOUNTS: Account[] = [];
const DEFAULT_TRANSACTIONS: Transaction[] = [];

export function useStore() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, number>>({});
  const [showPending, setShowPendingState] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txRaw, accRaw, tagsRaw, budgetsRaw, showPendingRaw] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.TAGS),
          AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_BUDGETS),
          AsyncStorage.getItem(STORAGE_KEYS.SHOW_PENDING),
        ]);

      setTransactions(txRaw ? JSON.parse(txRaw) : DEFAULT_TRANSACTIONS);
      setAccounts(accRaw ? JSON.parse(accRaw) : DEFAULT_ACCOUNTS);
      setTags(tagsRaw ? JSON.parse(tagsRaw) : DEFAULT_TAGS);
      setMonthlyBudgets(budgetsRaw ? JSON.parse(budgetsRaw) : {});

      if (showPendingRaw !== null) {
        setShowPendingState(JSON.parse(showPendingRaw));
      }
    } catch (e) {
      setTransactions(DEFAULT_TRANSACTIONS);
      setAccounts(DEFAULT_ACCOUNTS);
      setTags(DEFAULT_TAGS);
      setMonthlyBudgets({});
    } finally {
      setLoading(false);
    }
  };

  const setShowPending = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SHOW_PENDING,
      JSON.stringify(value),
    );
    setShowPendingState(value);
  }, []);

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

  const clearAllData = useCallback(async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TRANSACTIONS,
      STORAGE_KEYS.ACCOUNTS,
      STORAGE_KEYS.TAGS,
      STORAGE_KEYS.MONTHLY_BUDGETS,
      STORAGE_KEYS.SHOW_PENDING,
    ]);
    setTransactions(DEFAULT_TRANSACTIONS);
    setAccounts(DEFAULT_ACCOUNTS);
    setTags(DEFAULT_TAGS);
    setMonthlyBudgets({});
    setShowPendingState(true);
  }, []);

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

      // 1. LÓGICA DE CARTÃO (PARCELADO OU À VISTA)
      if (isCreditCard) {
        const baseDate = new Date(tx.date);

        const installmentsCount =
          tx.totalInstallments && tx.totalInstallments > 1
            ? tx.totalInstallments
            : 1;
        const installmentAmount = tx.amount / installmentsCount;
        const baseId = Date.now().toString();

        const cleanDescription = tx.description.replace(/\s\(\d+\/\d+\)$/, "");

        // 👉 LÓGICA REVERSA PARA DATAS (Evita o Paradoxo de Dezembro)
        let baseM = baseDate.getMonth() + 1;
        let baseY = baseDate.getFullYear();
        if (baseDate.getDate() >= closingDay) baseM += 1;
        if (dueDay < closingDay) baseM += 1;

        for (let i = 0; i < installmentsCount; i++) {
          let currentDate: Date;

          if (i === 0) {
            // Parcela 1: Data exata da compra
            currentDate = new Date(baseDate);
          } else {
            // Parcela 2 em diante: Calcula o mês alvo exato e seta para dia 1
            let targetInvM = baseM + i;
            let monthForDay1 = targetInvM - (dueDay < closingDay ? 1 : 0);

            // O JavaScript gerencia a transição de ano se monthForDay1 > 12
            currentDate = new Date(baseY, monthForDay1 - 1, 1, 12, 0, 0);
          }

          const descSuffix = installmentsCount > 1 ? ` (${i + 1}/${installmentsCount})` : '';

          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`,
            groupId: baseId,
            groupIndex: i, // Importante para remapeamento futuro
            description: `${cleanDescription}${descSuffix}`,
            amount: installmentAmount,
            date: currentDate.toISOString(),
            paid: false,
            paymentMethod: finalizedTxMethod,
            recurrence: 'unica',
          });
        }
      }
      // 2. RECORRÊNCIA MENSAL (Débito/Dinheiro)
      else if (tx.recurrence === 'mensal') {
        const baseId = Date.now().toString();
        const baseDate = new Date(tx.date);
        const maxRecurrences = 24;

        for (let i = 0; i < maxRecurrences; i++) {
          const currentDate = new Date(baseDate);
          currentDate.setMonth(baseDate.getMonth() + i);
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
      // 3. TRANSAÇÃO ÚNICA
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

        const cleanDescription = updatedTx.description.replace(/\s\(\d+\/\d+\)$/, "");

        txsToMutate.forEach((mutantOld) => {
          revertBalance(mutantOld);
          let newMutantDate = new Date(mutantOld.date);

          // 👉 Reposicionamento com Lógica Reversa ao Editar
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
            tagIds: updatedTx.tagIds,
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
        type: 'transferencia',
        date: new Date().toISOString(),
        accountId: sourceAccountId,
        tagIds: [],
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

  return {
    transactions,
    accounts,
    tags,
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
    saveTags,
    clearAllData,
    payCreditCardInvoice,
  };
}