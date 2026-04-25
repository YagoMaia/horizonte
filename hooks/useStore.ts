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
  // 2. Estado atualizado para ser um dicionário/Record
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, number>>(
    {},
  );
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
          AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_BUDGETS), // Usando a chave nova
          AsyncStorage.getItem(STORAGE_KEYS.SHOW_PENDING),
        ]);

      setTransactions(txRaw ? JSON.parse(txRaw) : DEFAULT_TRANSACTIONS);
      setAccounts(accRaw ? JSON.parse(accRaw) : DEFAULT_ACCOUNTS);
      setTags(tagsRaw ? JSON.parse(tagsRaw) : DEFAULT_TAGS);

      // 3. Fazendo parse do JSON para o novo dicionário de orçamentos
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
      STORAGE_KEYS.MONTHLY_BUDGETS, // Removendo a chave correta
      STORAGE_KEYS.SHOW_PENDING,
    ]);
    setTransactions(DEFAULT_TRANSACTIONS);
    setAccounts(DEFAULT_ACCOUNTS);
    setTags(DEFAULT_TAGS);
    setMonthlyBudgets({}); // Resetando o dicionário
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

      // Dia de fecho da fatura (padrão 31 se não definido)
      const closingDay = targetAccount?.closingDay || 31;

      // 1. LÓGICA DE CARTÃO (PARCELADO OU À VISTA)
      if (isCreditCard) {
        const baseDate = new Date(tx.date);
        const dayOfPurchase = baseDate.getDate();

        // 👉 CORREÇÃO AQUI: >= (Maior ou igual).
        // Se comprar no próprio dia do fechamento, já pula para a outra fatura.
        const shiftMonths = dayOfPurchase >= closingDay ? 2 : 1;

        const installmentsCount =
          tx.totalInstallments && tx.totalInstallments > 1
            ? tx.totalInstallments
            : 1;
        const installmentAmount = tx.amount / installmentsCount;

        const baseId = Date.now().toString();

        for (let i = 0; i < installmentsCount; i++) {
          const currentDate = new Date(baseDate);

          // Evita o erro de rollover de meses (ex: 31 de Março -> Abril)
          currentDate.setDate(1);
          currentDate.setMonth(baseDate.getMonth() + i + shiftMonths);

          // Ajusta para o dia original ou o último dia possível do mês (ex: 31 -> 28 de Fev)
          const lastDayOfTargetMonth = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0,
          ).getDate();
          currentDate.setDate(Math.min(dayOfPurchase, lastDayOfTargetMonth));

          const descSuffix =
            installmentsCount > 1 ? ` (${i + 1}/${installmentsCount})` : '';

          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`, // ID Agrupado para permitir eliminação em massa
            description: `${tx.description}${descSuffix}`,
            amount: installmentAmount,
            date: currentDate.toISOString(),
            paid: false,
            paymentMethod: finalizedTxMethod,
          });
        }
      }
      // 2. RECORRÊNCIA MENSAL (Débito/Dinheiro)
      else if (tx.recurrence === 'mensal') {
        const baseId = Date.now().toString();
        const baseDate = new Date(tx.date);
        for (let i = 0; i < 12; i++) {
          const currentDate = new Date(baseDate);
          currentDate.setMonth(baseDate.getMonth() + i);
          const isPaid = i === 0 ? tx.paid : false;

          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`,
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
    async (id: string) => {
      const tx = transactions.find((t) => t.id === id);
      if (!tx) return;

      // Lógica de eliminação em massa para parcelas/recorrências
      let idsToDelete = [id];
      if (id.includes('-')) {
        const baseId = id.split('-')[0];
        const relatedTxs = transactions.filter((t) =>
          t.id.startsWith(`${baseId}-`),
        );
        idsToDelete = relatedTxs.map((t) => t.id);
      }

      const updated = transactions.filter((t) => !idsToDelete.includes(t.id));
      await saveTransactions(updated);

      // Reverte o saldo de todas as transações eliminadas que estavam marcadas como pagas
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
            return acc;
          });
        }
      });

      await saveAccounts(updatedAccounts);
    },
    [transactions, accounts, saveTransactions, saveAccounts],
  );

  const updateTransaction = useCallback(
    async (updatedTx: Transaction) => {
      const oldTx = transactions.find((t) => t.id === updatedTx.id);
      if (!oldTx) return;

      let updatedAccounts = [...accounts];
      if (oldTx.paid) {
        updatedAccounts = updatedAccounts.map((acc) => {
          if (acc.id === oldTx.accountId) {
            const delta =
              oldTx.type === 'receita' ? -oldTx.amount : oldTx.amount;
            return { ...acc, balance: acc.balance + delta };
          }
          return acc;
        });
      }
      if (updatedTx.paid) {
        updatedAccounts = updatedAccounts.map((acc) => {
          if (acc.id === updatedTx.accountId) {
            const delta =
              updatedTx.type === 'receita'
                ? updatedTx.amount
                : -updatedTx.amount;
            return { ...acc, balance: acc.balance + delta };
          }
          return acc;
        });
      }
      const updatedTransactions = transactions.map((t) =>
        t.id === updatedTx.id ? updatedTx : t,
      );
      await saveTransactions(updatedTransactions);
      await saveAccounts(updatedAccounts);
    },
    [transactions, accounts, saveTransactions, saveAccounts],
  );

  const getEffectiveBudget = useCallback(
    (year: number, month: number) => {
      const currentKey = `${year}-${String(month).padStart(2, '0')}`;

      // Se existir um valor específico para este mês, usa ele
      if (monthlyBudgets[currentKey]) return monthlyBudgets[currentKey];

      // Caso contrário, busca o orçamento mais recente definido no passado
      const sortedKeys = Object.keys(monthlyBudgets).sort().reverse();
      for (const key of sortedKeys) {
        if (key < currentKey) return monthlyBudgets[key];
      }

      return 0; // Padrão se nunca nada foi definido
    },
    [monthlyBudgets],
  );

  // Atualize o save para usar a chave padronizada YYYY-MM
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

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const monthlyIncome = transactions
    .filter((t) => t.type === 'receita' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpense = transactions
    .filter((t) => t.type === 'despesa' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    transactions,
    accounts,
    tags,
    // 4. Expondo as novas propriedades e funções do orçamento
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
  };
}
