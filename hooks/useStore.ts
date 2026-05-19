// hooks/useStore.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account, Tag, DEFAULT_TAGS, Project, NotificationPreferences } from '@/constants/types';
import * as NotificationService from '../services/notificationService';
import { addMonths, addYears, addWeeks, addDays, setDate } from 'date-fns';

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  MONTHLY_BUDGETS: '@horizonte:monthly_budgets',
  SHOW_PENDING: '@horizonte:show_pending',
  TAGS: '@horizonte:tags',
  ONBOARDING: '@horizonte:onboarding',
  PROJECTS: '@horizonte:projects',
  NOTIFICATION_PREFS: '@horizonte:notification_prefs',
};

const DEFAULT_ACCOUNTS: Account[] = [];
const DEFAULT_TRANSACTIONS: Transaction[] = [];
const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  dailyReminders: true,
  dailyReminderTime: { hour: 20, minute: 0 },
  expenseReminders: true,
  expenseReminderTime: { hour: 9, minute: 0 },
  creditCardAlerts: true,
  creditCardAlertTime: { hour: 8, minute: 0 }
};

export function useStore() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, number>>({});
  const [showPending, setShowPendingState] = useState<boolean>(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);

  // --- MÉTODOS DE PROCESSAMENTO BASE (Sincronização) ---

  // 👉 REESCRITA SÊNIOR: Função Mestre Única para Sincronização de Saldo
  // Garante que o saldo bancário reflita apenas dinheiro real hoje (pago e data <= hoje).
  const syncBalances = useCallback(async (currentTransactions: Transaction[], currentAccounts: Account[]) => {
    // Pegamos o início do dia de hoje (meia-noite local)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updatedAccounts = currentAccounts.map((acc) => {
      // Cartão de crédito não possui "saldo" positivo no banco, seu saldo é exibido como fatura.
      if (acc.type === 'cartao_credito') {
        return { ...acc, balance: 0 };
      }

      let calculatedBalance = 0;
      currentTransactions.forEach((tx) => {
        // Regra 1: Somente transações efetivadas (pagas)
        if (!tx.paid) return;

        // Regra 2: Ignora o futuro no saldo de HOJE
        // Extraímos a data do ISO sem shift de fuso horário
        const txDateParts = tx.date.split('T')[0].split('-').map(Number);
        const txDate = new Date(txDateParts[0], txDateParts[1] - 1, txDateParts[2]);
        txDate.setHours(0, 0, 0, 0);

        if (txDate > today) return;

        // Regra 3: Soma/Subtrai baseado na conta
        if (tx.accountId === acc.id) {
          if (tx.type === 'receita') calculatedBalance += tx.amount;
          else if (tx.type === 'despesa') calculatedBalance -= tx.amount;
          else if (tx.type === 'transferencia') calculatedBalance -= tx.amount;
        }

        // Regra 4: Entradas via transferência
        if (tx.type === 'transferencia' && tx.targetAccountId === acc.id) {
          calculatedBalance += tx.amount;
        }
      });

      return { ...acc, balance: calculatedBalance };
    });

    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updatedAccounts));
    setAccounts(updatedAccounts);
    return updatedAccounts;
  }, []);

  const autoProcessOverdueTransactions = useCallback(async (currentTransactions: Transaction[], currentAccounts: Account[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let hasChanges = false;
    const updatedTransactions = currentTransactions.map(tx => {
      const txDateParts = tx.date.split('T')[0].split('-').map(Number);
      const txDate = new Date(txDateParts[0], txDateParts[1] - 1, txDateParts[2]);
      txDate.setHours(0, 0, 0, 0);

      const isOverdue = txDate <= today;

      const targetAccount = currentAccounts.find(a => a.id === tx.accountId);
      const isCreditCard = targetAccount?.type === 'cartao_credito';

      // Marcar como pago automaticamente se estiver vencido e não for cartão
      if (!tx.paid && !isCreditCard && isOverdue) {
        hasChanges = true;
        return { ...tx, paid: true };
      }
      return tx;
    });

    if (hasChanges) {
      await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updatedTransactions));
      setTransactions(updatedTransactions);
      await syncBalances(updatedTransactions, currentAccounts);
    }
  }, [syncBalances]);

  // --- MÉTODOS DE SALVAMENTO ---

  const saveTransactions = useCallback(async (data: Transaction[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data));
    setTransactions(data);
  }, []);

  const saveAccounts = useCallback(async (data: Account[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(data));
    setAccounts(data);
  }, []);

  const saveProjects = useCallback(async (data: Project[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(data));
    setProjects(data);
  }, []);

  const saveTags = useCallback(async (data: Tag[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(data));
    setTags(data);
  }, []);

  const saveNotificationPreferences = useCallback(async (data: NotificationPreferences) => {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFS, JSON.stringify(data));
    setNotificationPreferences(data);
  }, []);

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

  const toggleNotificationPreference = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...notificationPreferences, [key]: value };
    await saveNotificationPreferences(updated);

    if (key === 'dailyReminders') {
      if (value) {
        await NotificationService.scheduleDailyReminder(
          notificationPreferences.dailyReminderTime.hour,
          notificationPreferences.dailyReminderTime.minute
        );
      }
    }
    // Para despesas e cartões, se desativar, poderíamos cancelar tudo, 
    // mas o sistema já lida com isso na hora de criar/editar.
    // Se ativar, não reagendamos tudo automaticamente para não sobrecarregar,
    // o usuário teria que editar ou criar novos. 
    // Mas para o tempo, talvez precisemos de um "rescheduleAll".
  }, [notificationPreferences, saveNotificationPreferences]);

  const updateNotificationTime = useCallback(async (key: 'dailyReminderTime' | 'expenseReminderTime' | 'creditCardAlertTime', hour: number, minute: number) => {
    const updated = { ...notificationPreferences, [key]: { hour, minute } };
    await saveNotificationPreferences(updated);

    if (key === 'dailyReminderTime' && notificationPreferences.dailyReminders) {
      await NotificationService.scheduleDailyReminder(hour, minute);
    }

    if (key === 'expenseReminderTime' && notificationPreferences.expenseReminders) {
      // Reschedule all expense reminders
      const updatedTransactions = [...transactions];
      for (let i = 0; i < updatedTransactions.length; i++) {
        const tx = updatedTransactions[i];
        if (tx.type === 'despesa' && !tx.paid) {
          if (tx.notificationId) {
            await NotificationService.cancelReminder(tx.notificationId);
          }
          const notificationId = await NotificationService.scheduleTransactionReminder(
            tx.description,
            tx.amount,
            new Date(tx.date),
            hour,
            minute
          );
          updatedTransactions[i] = { ...tx, notificationId };
        }
      }
      await saveTransactions(updatedTransactions);
    }

    if (key === 'creditCardAlertTime' && notificationPreferences.creditCardAlerts) {
      // Reschedule all credit card reminders
      const updatedAccounts = [...accounts];
      for (let i = 0; i < updatedAccounts.length; i++) {
        const acc = updatedAccounts[i];
        if (acc.type === 'cartao_credito' && acc.dueDay) {
          if (acc.notificationId) {
            await NotificationService.cancelReminder(acc.notificationId);
          }
          const notificationId = await NotificationService.scheduleCreditCardReminder(
            acc.name,
            acc.dueDay,
            hour,
            minute
          );
          updatedAccounts[i] = { ...acc, notificationId };
        }
      }
      await saveAccounts(updatedAccounts);
    }
  }, [notificationPreferences, transactions, accounts, saveNotificationPreferences, saveTransactions, saveAccounts]);

  const addProject = useCallback(async (project: Omit<Project, 'id'>) => {
    const newProject: Project = { ...project, id: Date.now().toString() };
    const updated = [...projects, newProject];
    await saveProjects(updated);
  }, [projects, saveProjects]);

  const updateProject = useCallback(async (updatedProject: Project) => {
    const updated = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    await saveProjects(updated);
  }, [projects, saveProjects]);

  const deleteProject = useCallback(async (id: string) => {
    // 1. Remove o projeto
    const updatedProjects = projects.filter(p => p.id !== id);
    await saveProjects(updatedProjects);

    // 2. Remove o vínculo das transações (mantém a transação, mas limpa o projectId)
    const updatedTxs = transactions.map(tx =>
      tx.projectId === id ? { ...tx, projectId: undefined } : tx
    );
    await saveTransactions(updatedTxs);
  }, [projects, transactions, saveProjects, saveTransactions]);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify(true));
    setHasSeenOnboarding(true);
  }, []);
  const addAccount = useCallback(
    async (acc: Account) => {
      let notificationId: string | undefined;

      // Agenda lembrete se for cartão de crédito
      if (acc.type === 'cartao_credito' && acc.dueDay && notificationPreferences.creditCardAlerts) {
        notificationId = await NotificationService.scheduleCreditCardReminder(
          acc.name,
          acc.dueDay,
          notificationPreferences.creditCardAlertTime.hour,
          notificationPreferences.creditCardAlertTime.minute
        );
      }

      const accountWithNotification = { ...acc, notificationId };
      const updatedAccounts = [...accounts, accountWithNotification];
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
    [accounts, transactions, saveAccounts, saveTransactions, notificationPreferences.expenseReminders],
  );

  const updateAccount = useCallback(
    async (updatedAcc: Account, skipAdjustment = false) => {
      const oldAcc = accounts.find((a) => a.id === updatedAcc.id);
      if (!oldAcc) return;

      let notificationId = oldAcc.notificationId;

      // Reagenda lembrete se dia de vencimento ou nome mudou
      if (updatedAcc.type === "cartao_credito" &&
        (updatedAcc.dueDay !== oldAcc.dueDay || updatedAcc.name !== oldAcc.name)
      ) {
        if (notificationId) {
          await NotificationService.cancelReminder(notificationId);
        }
        if (updatedAcc.dueDay && notificationPreferences.creditCardAlerts) {
          notificationId = await NotificationService.scheduleCreditCardReminder(
            updatedAcc.name,
            updatedAcc.dueDay,
            notificationPreferences.creditCardAlertTime.hour,
            notificationPreferences.creditCardAlertTime.minute
          );
        }
      }

      let finalTransactions = transactions;
      if (
        !skipAdjustment &&
        updatedAcc.type !== "cartao_credito" && // <--- MUDOU AQUI
        updatedAcc.balance !== oldAcc.balance   // <--- MUDOU AQUI
      ) {
        const diff = updatedAcc.balance - oldAcc.balance; // <--- MUDOU AQUI
        const adjustmentTx: Transaction = {
          id: `adj-${Date.now()}`,
          description: "Ajuste de Saldo",
          amount: Math.abs(diff),
          type: diff > 0 ? "receita" : "despesa",
          date: new Date().toISOString(),
          accountId: updatedAcc.id, // <--- MUDOU AQUI
          paid: true,
          recurrence: "unica",
          isAdjustment: true,
        };
        finalTransactions = [adjustmentTx, ...transactions];
        await saveTransactions(finalTransactions);
      }

      const updatedAccounts = accounts.map((a) =>
        a.id === updatedAcc.id ? updatedAcc : a, // <--- MUDOU AQUI (nas duas vezes)
      );
      await syncBalances(finalTransactions, updatedAccounts);
    },
    [accounts, transactions, saveTransactions, syncBalances, notificationPreferences],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      const targetAcc = accounts.find(a => a.id === id);

      if (targetAcc?.notificationId) {
        NotificationService.cancelReminder(targetAcc.notificationId);
      }

      const updatedAccounts = accounts.filter((a) => a.id !== id);
      const updatedTransactions = transactions.filter(
        (tx) => tx.accountId !== id && tx.targetAccountId !== id,
      );

      await saveTransactions(updatedTransactions);
      await syncBalances(updatedTransactions, updatedAccounts);
    },
    [accounts, transactions, saveTransactions, syncBalances],
  );

  const setPrimaryAccount = useCallback(
    async (id: string) => {
      const accIndex = accounts.findIndex((a) => a.id === id);
      if (accIndex <= 0) return;

      const updated = [...accounts];
      const [acc] = updated.splice(accIndex, 1);
      updated.unshift(acc);

      await saveAccounts(updated);
    },
    [accounts, saveAccounts],
  );

  const loadData = useCallback(async () => {
    try {
      const [txRaw, accRaw, budgetsRaw, showPendingRaw, tagsRaw, onboardingRaw, projectsRaw, notifPrefsRaw] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
          AsyncStorage.getItem(STORAGE_KEYS.ACCOUNTS),
          AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_BUDGETS),
          AsyncStorage.getItem(STORAGE_KEYS.SHOW_PENDING),
          AsyncStorage.getItem(STORAGE_KEYS.TAGS),
          AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
          AsyncStorage.getItem(STORAGE_KEYS.PROJECTS),
          AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFS),
        ]);

      const loadedTransactions = txRaw ? JSON.parse(txRaw) : DEFAULT_TRANSACTIONS;
      const loadedAccounts = accRaw ? JSON.parse(accRaw) : DEFAULT_ACCOUNTS;
      const loadedTags = tagsRaw ? JSON.parse(tagsRaw) : DEFAULT_TAGS;
      const loadedProjects = projectsRaw ? JSON.parse(projectsRaw) : [];

      setTransactions(loadedTransactions);
      setAccounts(loadedAccounts);
      setTags(loadedTags);
      setProjects(loadedProjects);
      setMonthlyBudgets(budgetsRaw ? JSON.parse(budgetsRaw) : {});
      setHasSeenOnboarding(onboardingRaw ? JSON.parse(onboardingRaw) : false);

      if (showPendingRaw !== null) {
        setShowPendingState(JSON.parse(showPendingRaw));
      }

      if (notifPrefsRaw !== null) {
        setNotificationPreferences(JSON.parse(notifPrefsRaw));
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
      STORAGE_KEYS.ONBOARDING,
      STORAGE_KEYS.PROJECTS,
      STORAGE_KEYS.NOTIFICATION_PREFS,
    ]);
    setTransactions(DEFAULT_TRANSACTIONS);
    setAccounts(DEFAULT_ACCOUNTS);
    setTags(DEFAULT_TAGS);
    setProjects([]);
    setMonthlyBudgets({});
    setShowPendingState(true);
    setHasSeenOnboarding(false);
    setNotificationPreferences(DEFAULT_NOTIFICATION_PREFS);
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
      const targetAccount = accounts.find((a) => a.id === tx.accountId);
      const isCreditCard = targetAccount?.type === 'cartao_credito';
      const finalizedTxMethod = isCreditCard ? 'credito' : tx.paymentMethod || 'debito';

      const closingDay = targetAccount?.closingDay || 25;
      const dueDay = targetAccount?.dueDay || 5;

      if (isCreditCard && tx.totalInstallments && tx.totalInstallments > 1) {
        // Lógica de parcelamento
        const parts = tx.date.split('T')[0].split('-').map(Number);
        const baseDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
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
          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`,
            groupId: baseId,
            groupIndex: i,
            description: `${cleanDescription} (${i + 1}/${installmentsCount})`,
            amount: installmentAmount,
            date: currentDate.toISOString(),
            paid: false,
            paymentMethod: finalizedTxMethod,
            recurrence: 'unica',
          });
        }
      }
      else if (tx.recurrence !== 'unica') {
        const baseId = Date.now().toString();
        const parts = tx.date.split('T')[0].split('-').map(Number);
        // Usamos meio-dia para evitar problemas de fuso horário ao manipular datas
        let baseDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);

        if (tx.startNextMonth) {
          baseDate = addMonths(baseDate, 1);
        }

        const maxRecurrences = tx.calculatedRecurrenceCount || 24;

        for (let i = 0; i < maxRecurrences; i++) {
          let effectiveDate: Date;

          switch (tx.recurrence) {
            case 'mensal':
              effectiveDate = addMonths(baseDate, i);
              break;
            case 'anual':
              effectiveDate = addYears(baseDate, i);
              break;
            case 'semanal':
              effectiveDate = addWeeks(baseDate, i);
              break;
            case 'diaria':
              effectiveDate = addDays(baseDate, i);
              break;
            case 'quinto_dia_util': {
              const targetMonthDate = addMonths(baseDate, i);
              const targetMonth = targetMonthDate.getMonth();
              const targetYear = targetMonthDate.getFullYear();
              let businessDaysCount = 0;
              let day = 1;
              while (businessDaysCount < 5) {
                const d = new Date(targetYear, targetMonth, day);
                const dayOfWeek = d.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDaysCount++;
                if (businessDaysCount < 5) day++;
              }
              effectiveDate = new Date(targetYear, targetMonth, day, 12, 0, 0);
              break;
            }
            default:
              effectiveDate = addMonths(baseDate, i);
          }

          // Trava de segurança: Se a data for no futuro, força o paid para false
          // Isso impede que lançamentos futuros sumam da projeção do Horizonte
          const hojeFiltro = new Date();
          hojeFiltro.setHours(0, 0, 0, 0);
          const isFuture = effectiveDate > hojeFiltro;

          const isPaid = isCreditCard ? false : (i === 0 ? (isFuture ? false : tx.paid) : false);

          let notificationId: string | undefined;
          if (tx.type === 'despesa' && notificationPreferences.expenseReminders) {
            notificationId = await NotificationService.scheduleTransactionReminder(
              tx.description,
              tx.amount,
              effectiveDate,
              notificationPreferences.expenseReminderTime.hour,
              notificationPreferences.expenseReminderTime.minute
            );
          }

          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`,
            groupId: baseId,
            groupIndex: i,
            date: effectiveDate.toISOString(),
            paid: isPaid,
            paymentMethod: finalizedTxMethod,
            notificationId,
          });
        }
      }
      else {
        const newTx: Transaction = {
          ...tx,
          id: Date.now().toString(),
          paymentMethod: finalizedTxMethod,
        };
        newTransactions.push(newTx);
      }

      const updated = [...newTransactions, ...transactions];
      await saveTransactions(updated);
      await syncBalances(updated, accounts); // Recálculo global
      return newTransactions[0];
    },
    [transactions, accounts, saveTransactions, syncBalances, notificationPreferences],
  );

  const deleteTransaction = useCallback(
    async (id: string, mode: 'single' | 'future' | 'all' = 'single') => {
      const targetTx = transactions.find((t) => t.id === id);
      if (!targetTx) return;

      let idsToDelete = [id];
      const isPartOfFamily = targetTx.groupId || id.includes('-');

      if (isPartOfFamily && mode !== 'single') {
        const baseId = targetTx.groupId || id.split('-')[0];
        const familyTxs = transactions.filter(t => t.groupId === baseId || t.id.startsWith(`${baseId}-`));
        if (mode === 'all') {
          idsToDelete = familyTxs.map(t => t.id);
        } else if (mode === 'future') {
          const targetDateStr = targetTx.date.split('T')[0];
          idsToDelete = familyTxs.filter(t => t.date.split('T')[0] >= targetDateStr).map(t => t.id);
        }
      }

      const updated = transactions.filter((t) => !idsToDelete.includes(t.id));

      // Limpeza de lembretes
      transactions.filter(t => idsToDelete.includes(t.id)).forEach(t => {
        if (t.notificationId) NotificationService.cancelReminder(t.notificationId);
      });

      await saveTransactions(updated);
      await syncBalances(updated, accounts); // Recálculo global
    },
    [transactions, accounts, saveTransactions, syncBalances],
  );

  const updateTransaction = useCallback(
    async (updatedTx: Transaction, mode: 'single' | 'future' | 'all' = 'single') => {
      const oldTx = transactions.find((t) => t.id === updatedTx.id);
      if (!oldTx) return;

      let finalTransactions = [...transactions];
      const isPartOfFamily = oldTx.groupId || oldTx.id.includes('-');

      if (isPartOfFamily && mode !== 'single') {
        const baseId = oldTx.groupId || oldTx.id.split('-')[0];
        const familyTxs = transactions.filter(t => t.groupId === baseId || t.id.startsWith(`${baseId}-`));
        const targetDateStr = oldTx.date.split('T')[0];
        const txsToMutate = mode === 'all' ? familyTxs : familyTxs.filter(t => t.date.split('T')[0] >= targetDateStr);

        for (const mutantOld of txsToMutate) {
          const mutantNew = { ...updatedTx, id: mutantOld.id, groupId: mutantOld.groupId, groupIndex: mutantOld.groupIndex, paid: mutantOld.paid };
          finalTransactions = finalTransactions.map(t => t.id === mutantNew.id ? mutantNew : t);
        }
      } else {
        finalTransactions = finalTransactions.map(t => t.id === updatedTx.id ? updatedTx : t);
      }

      await saveTransactions(finalTransactions);
      await syncBalances(finalTransactions, accounts); // Recálculo global
    },
    [transactions, accounts, saveTransactions, syncBalances],
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

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, a) => {
      if (a.type === 'cartao_credito') {
        return sum;
      }
      return sum + a.balance;
    }, 0);
  }, [accounts]);

  const payCreditCardInvoice = useCallback(
    async (
      creditCardId: string,
      sourceAccountId: string | null,
      targetMonth: number,
      targetYear: number,
      gerarLancamento = true,
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

      let finalTransactions = updatedTransactions;
      let updatedAccounts = [...accounts];

      if (gerarLancamento && sourceAccountId) {
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

        finalTransactions = [paymentTx, ...updatedTransactions];
      }

      await saveTransactions(finalTransactions);
      await syncBalances(finalTransactions, accounts); // 👉 Sincronização Sênior
    },
    [transactions, accounts, saveTransactions, syncBalances],
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

      await saveTransactions(finalTransactions);
      await syncBalances(finalTransactions, accounts); // 👉 Sincronização Sênior
    },
    [transactions, accounts, saveTransactions, syncBalances]
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

      // Limpeza de lembretes
      transactions.filter(t => finalIdsToRemove.includes(t.id)).forEach(t => {
        if (t.notificationId) NotificationService.cancelReminder(t.notificationId);
      });

      await saveTransactions(updated);
      await syncBalances(updated, accounts); // 👉 Sincronização Sênior
    },
    [transactions, accounts, saveTransactions, syncBalances],
  );

  const purgeAdjustments = useCallback(async () => {
    const updatedTxs = transactions.filter((tx) => !tx.isAdjustment);
    await saveTransactions(updatedTxs);
  }, [transactions, saveTransactions]);

  const getProjectSpent = useCallback((projectId: string) => {
    if (!projectId) return 0;
    const projectTxs = transactions.filter(tx => tx.projectId === projectId);
    return projectTxs.reduce((sum, tx) => {
      const amount = Number(tx.amount) || 0;
      // Considera despesas e transferências como gasto positivo (saída).
      // Receita no projeto subtrai do gasto (ex: reembolso).
      if (tx.type === 'despesa' || tx.type === 'transferencia') {
        return sum + amount;
      }
      if (tx.type === 'receita') {
        return sum - amount;
      }
      return sum;
    }, 0);
  }, [transactions]);

  const getInvoiceTotalForMonth = useCallback((creditCardId: string, targetMonth: number, targetYear: number) => {
    const cardAccount = accounts.find((a) => a.id === creditCardId);
    if (!cardAccount || cardAccount.type !== 'cartao_credito') return 0;
  
    const closingDay = cardAccount.closingDay || 25;
    const dueDay = cardAccount.dueDay || 5;
    let invoiceTotal = 0;
  
    transactions.forEach((tx) => {
      // Ignora outras contas ou métodos.
      // NÃO filtramos tx.paid aqui, pois a tela de faturas soma tudo (pago ou não).
      if (tx.accountId !== creditCardId || tx.paymentMethod !== 'credito') return;
  
      // Como o app já desmembra parcelas e recorrências, avaliamos apenas a data salva
      const d = new Date(tx.date);
      let m = d.getMonth() + 1;
      let y = d.getFullYear();
  
      if (d.getDate() >= closingDay) m += 1;
      if (dueDay < closingDay) m += 1;
  
      while (m > 12) {
        m -= 12;
        y += 1;
      }
  
      if ((m - 1) === targetMonth && y === targetYear) {
        invoiceTotal += (tx.type === 'receita' ? -tx.amount : tx.amount);
      }
    });
  
    return invoiceTotal;
  }, [transactions, accounts]);
  return {
    notificationPreferences,
    toggleNotificationPreference,
    updateNotificationTime,
    transactions,
    accounts,
    projects, // 👉 Exportando projetos
    addProject,
    updateProject,
    deleteProject,
    getProjectSpent, // 👉 Nova função de cálculo centralizada
    getInvoiceTotalForMonth, // 👉 Nova função de projeção de fatura
    tags, // 👉 Exportando tags
    addTag, // 👉 Exportando métodos de tag
    updateTag,
    deleteTag,
    monthlyBudgets,
    getEffectiveBudget,
    saveMonthlyBudget,
    showPending,
    setShowPending,
    hasSeenOnboarding,
    completeOnboarding,
    loading,
    totalBalance,
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