// hooks/useStore.ts
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account, Tag, DEFAULT_TAGS } from '@/constants/types';
import * as NotificationService from '@/services/notificationService';

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  MONTHLY_BUDGETS: '@horizonte:monthly_budgets',
  SHOW_PENDING: '@horizonte:show_pending',
  TAGS: '@horizonte:tags',
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

  const addAccount = useCallback(
    async (acc: Account) => {
      const updatedAccounts = [...accounts, acc];
      await saveAccounts(updatedAccounts);

      if (acc.type !== "cartao_credito" && acc.balance !== 0) {
        // Para Saldo Inicial, definimos a data como o início do mês atual
        // Isso evita que a projeção do Horizonte "achate" o saldo dos dias anteriores
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const adjustmentTx: Transaction = {
          id: `adj-${Date.now()}`,
          description: "Saldo Inicial",
          amount: Math.abs(acc.balance),
          type: acc.balance > 0 ? "receita" : "despesa",
          date: startOfMonth.toISOString(),
          accountId: acc.id,
          paid: true,
          recurrence: "unica",
          isAdjustment: true,
        };
        await saveTransactions([adjustmentTx, ...transactions]);
      }
    },
    [accounts, transactions, saveAccounts, saveTransactions],
  );

  const updateAccount = useCallback(
    async (updatedAcc: Account, skipAdjustment = false) => {
      const oldAcc = accounts.find((a) => a.id === updatedAcc.id);
      if (!oldAcc) return;

      if (
        !skipAdjustment &&
        updatedAcc.type !== "cartao_credito" &&
        updatedAcc.balance !== oldAcc.balance
      ) {
        const diff = updatedAcc.balance - oldAcc.balance;
        const adjustmentTx: Transaction = {
          id: `adj-${Date.now()}`,
          description: "Ajuste de Saldo",
          amount: Math.abs(diff),
          type: diff > 0 ? "receita" : "despesa",
          date: new Date().toISOString(),
          accountId: updatedAcc.id,
          paid: true,
          recurrence: "unica",
          isAdjustment: true,
        };
        await saveTransactions([adjustmentTx, ...transactions]);
      }

      const updatedAccounts = accounts.map((a) =>
        a.id === updatedAcc.id ? updatedAcc : a,
      );
      await saveAccounts(updatedAccounts);
    },
    [accounts, transactions, saveAccounts, saveTransactions],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      // 1. Atualiza as contas
      setAccounts((currentAccounts) => {
        const updated = currentAccounts.filter((a) => a.id !== id);
        AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
        return updated;
      });

      // 2. Cascade Delete: Remove todas as transações vinculadas a esta conta
      // Isso inclui transações onde ela é a conta principal (accountId)
      // OU onde ela é a conta de destino em transferências (targetAccountId)
      setTransactions((currentTransactions) => {
        const updatedTxs = currentTransactions.filter(
          (tx) => tx.accountId !== id && tx.targetAccountId !== id,
        );
        AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updatedTxs));
        return updatedTxs;
      });
    },
    [],
  );

  const setPrimaryAccount = useCallback(
    async (id: string) => {
      setAccounts((currentAccounts) => {
        const accIndex = currentAccounts.findIndex((a) => a.id === id);
        if (accIndex <= 0) return currentAccounts;

        const updated = [...currentAccounts];
        const [acc] = updated.splice(accIndex, 1);
        updated.unshift(acc);

        AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

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

      if (isCreditCard && tx.totalInstallments && tx.totalInstallments > 1) {
        const baseDate = new Date(tx.date);
        const installmentsCount = tx.totalInstallments;
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

          const descSuffix = ` (${i + 1}/${installmentsCount})`;

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

        let baseM = baseDate.getMonth() + 1;
        let baseY = baseDate.getFullYear();
        if (isCreditCard) {
          if (baseDate.getDate() >= closingDay) baseM += 1;
          if (dueDay < closingDay) baseM += 1;
        }

        for (let i = 0; i < maxRecurrences; i++) {
          let currentDate = new Date(baseDate);

          if (isCreditCard && i > 0) {
            let targetInvM = baseM + i;
            let monthForDay1 = targetInvM - (dueDay < closingDay ? 1 : 0);
            currentDate = new Date(baseY, monthForDay1 - 1, 1, 12, 0, 0);
          } else {
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
          }

          const isPaid = isCreditCard ? false : (i === 0 ? tx.paid : false);

          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`,
            groupId: baseId,
            groupIndex: i,
            date: currentDate.toISOString(),
            paid: isPaid,
            paymentMethod: finalizedTxMethod,
          });

          if (isPaid && !isCreditCard) {
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
        let notificationId: string | undefined;

        // Lembrete de Pagamento Mensal
        if (tx.type === 'despesa' && tx.recurrence === 'mensal') {
          const date = new Date(tx.date);
          notificationId = await NotificationService.scheduleMonthlyPaymentReminder(
            tx.description,
            tx.amount,
            date.getDate()
          );
        }

        const newTx: Transaction = {
          ...tx,
          id: Date.now().toString(),
          paymentMethod: finalizedTxMethod,
          notificationId, // 👉 Salvando o ID da notificação
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
        // 👉 Cancela o lembrete se existir um notificationId
        if (deletedTx.notificationId) {
          NotificationService.cancelReminder(deletedTx.notificationId);
        }

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

  const syncBalances = useCallback(async () => {
    const updatedAccounts = accounts.map((acc) => {
      if (acc.type === 'cartao_credito') {
        return { ...acc, balance: 0 };
      }

      let calculatedBalance = 0;

      transactions.forEach((tx) => {
        if (!tx.paid) return;

        if (tx.accountId === acc.id) {
          if (tx.type === 'receita') {
            calculatedBalance += tx.amount;
          } else if (tx.type === 'despesa') {
            calculatedBalance -= tx.amount;
          } else if (tx.type === 'transferencia') {
            calculatedBalance -= tx.amount;
          }
        }

        if (tx.type === 'transferencia' && tx.targetAccountId === acc.id) {
          calculatedBalance += tx.amount;
        }
      });

      return { ...acc, balance: calculatedBalance };
    });

    await saveAccounts(updatedAccounts);
    return updatedAccounts;
  }, [accounts, transactions, saveAccounts]);

  const purgeAdjustments = useCallback(async () => {
    const updatedTxs = transactions.filter((tx) => !tx.isAdjustment);
    await saveTransactions(updatedTxs);
  }, [transactions, saveTransactions]);

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
    addAccount,
    updateAccount,
    deleteAccount,
    setPrimaryAccount,
    saveAccounts,
    syncBalances,
    purgeAdjustments,
    clearAllData,
    payCreditCardInvoice,
    anticipateCreditCardPayment,
    deleteMultipleTransactions,
  };
}
