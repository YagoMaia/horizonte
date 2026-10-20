// hooks/useStore.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account, Tag, DEFAULT_TAGS, Project, NotificationPreferences, UserSettings } from '@/constants/types';
import * as NotificationService from '../services/notificationService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { addMonths, addYears, addWeeks, addDays, setDate } from 'date-fns';
import { getInvoiceTotal } from '@/lib/utils';
import { financialDate, dayKey } from '@/lib/financialDate';
import { buildFinancialIndex, calculateAccountBalances, EMPTY_PROJECT } from '@/lib/financialIndex';
import { useToday } from './useToday';
import { prepareCardPayment, reverseRecordedPayment, CardPaymentRequest } from '@/lib/cardPayment';
import { commitLedger } from '@/lib/ledgerStorage';
import { recoverPendingRestore, restoreBackup as restoreBackupStorage } from '@/lib/backup';

const STORAGE_KEYS = {
  TRANSACTIONS: '@horizonte:transactions',
  ACCOUNTS: '@horizonte:accounts',
  MONTHLY_BUDGETS: '@horizonte:monthly_budgets',
  SHOW_PENDING: '@horizonte:show_pending',
  TAGS: '@horizonte:tags',
  ONBOARDING: '@horizonte:onboarding',
  PROJECTS: '@horizonte:projects',
  NOTIFICATION_PREFS: '@horizonte:notification_prefs',
  GOALS: '@horizonte:goals',
  HOME_LAYOUT: '@horizonte:home_layout',
  TOTAIS_LAYOUT: '@horizonte:totais_layout',
  USER_SETTINGS: '@horizonte:user_settings',
};

const DEFAULT_USER_SETTINGS: UserSettings = {
  dailyAllowance: 0,
  safetyMargin: 0,
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
  const cardWriteLock = useRef(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storedAccounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, number>>({});
  const [showPending, setShowPendingState] = useState<boolean>(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [homeLayout, setHomeLayout] = useState<any[]>([
    { id: 'balance', visible: true },
    { id: 'accounts', visible: true },
    { id: 'projects', visible: true },
    { id: 'goals', visible: true },
    { id: 'transactions', visible: true },
  ]);
  const [totaisLayout, setTotaisLayout] = useState<any[]>([
    { id: 'stats', visible: true },
    { id: 'category', visible: true },
    { id: 'period', visible: true },
  ]);

  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);

  const today = useToday();
  const financialIndex = useMemo(() => buildFinancialIndex(storedAccounts, transactions, goals, financialDate(today)), [storedAccounts, transactions, goals, today]);
  const accounts = useMemo(() => storedAccounts.map(account => ({ ...account, balance: financialIndex.balances.get(account.id) || 0 })), [storedAccounts, financialIndex]);
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;
  // --- MÉTODOS DE PROCESSAMENTO BASE (Sincronização) ---

  // 👉 REESCRITA SÊNIOR: Função Mestre Única para Sincronização de Saldo
  // Garante que o saldo bancário reflita apenas dinheiro real hoje (pago e data <= hoje).
  const syncBalances = useCallback(async (currentTransactions: Transaction[], currentAccounts: Account[]) => {
    const updatedAccounts = calculateAccountBalances(currentAccounts, currentTransactions);

    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updatedAccounts));
    setAccounts(updatedAccounts);
    return updatedAccounts;
  }, []);

  // --- MÉTODOS DE SALVAMENTO ---

  const saveTransactions = useCallback(async (data: Transaction[]) => {
    if (cardWriteLock.current) throw new Error('Aguarde a gravação do pagamento.');
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
      if (value) await NotificationService.scheduleDailyReminder(updated.dailyReminderTime.hour, updated.dailyReminderTime.minute);
      else await NotificationService.cancelDailyReminder();
    } else if (key === 'expenseReminders') {
      if (value) await NotificationService.scheduleExpenseReminder(updated.expenseReminderTime.hour, updated.expenseReminderTime.minute);
      else await NotificationService.cancelExpenseReminder();
    } else if (key === 'creditCardAlerts') {
      if (value) await NotificationService.scheduleCreditCardAlert(updated.creditCardAlertTime.hour, updated.creditCardAlertTime.minute);
      else await NotificationService.cancelCreditCardAlert();
    }
  }, [notificationPreferences, saveNotificationPreferences]);

  const updateNotificationTime = useCallback(async (key: 'dailyReminderTime' | 'expenseReminderTime' | 'creditCardAlertTime', hour: number, minute: number) => {
    const updated = { ...notificationPreferences, [key]: { hour, minute } };
    await saveNotificationPreferences(updated);

    if (key === 'dailyReminderTime' && updated.dailyReminders) {
      await NotificationService.scheduleDailyReminder(hour, minute);
    } else if (key === 'expenseReminderTime' && updated.expenseReminders) {
      await NotificationService.scheduleExpenseReminder(hour, minute);
    } else if (key === 'creditCardAlertTime' && updated.creditCardAlerts) {
      await NotificationService.scheduleCreditCardAlert(hour, minute);
    }
  }, [notificationPreferences, saveNotificationPreferences]);

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
    const updatedProjects = projects.filter(p => p.id !== id);
    await saveProjects(updatedProjects);

    const updatedTxs = transactions.map(tx =>
      tx.projectId === id ? { ...tx, projectId: undefined } : tx
    );
    await saveTransactions(updatedTxs);
  }, [projects, transactions, saveProjects, saveTransactions]);

  // --- MÉTODOS PARA METAS (GOALS) ---
  const saveGoals = useCallback(async (newGoals: any[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(newGoals));
      setGoals(newGoals);
    } catch (e) {
      console.error('Failed to save goals', e);
    }
  }, []);

  const addGoal = useCallback(async (goal: Omit<any, 'id'>) => {
    const newGoal = { ...goal, id: Date.now().toString() };
    const updated = [...goals, newGoal];
    await saveGoals(updated);
  }, [goals, saveGoals]);

  const updateGoal = useCallback(async (updatedGoal: any) => {
    const updated = goals.map(g => g.id === updatedGoal.id ? updatedGoal : g);
    await saveGoals(updated);
  }, [goals, saveGoals]);

  const deleteGoal = useCallback(async (id: string) => {
    const updatedGoals = goals.filter(g => g.id !== id);
    await saveGoals(updatedGoals);

    // Remove the goal from any associated transactions
    const updatedTxs = transactions.map(tx => {
      if (tx.goalIds && tx.goalIds.includes(id)) {
        const newGoalIds = tx.goalIds.filter(gid => gid !== id);
        return { ...tx, goalIds: newGoalIds.length > 0 ? newGoalIds : undefined };
      }
      return tx;
    });
    
    // Check if any transactions were modified
    const hasChanges = updatedTxs.some((tx, index) => tx.goalIds !== transactions[index].goalIds);
    if (hasChanges) {
      setTransactions(updatedTxs);
      await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updatedTxs));
    }
  }, [goals, transactions, saveGoals]);

  const updateHomeLayout = useCallback(async (newLayout: any[]) => {
    setHomeLayout(newLayout);
    await AsyncStorage.setItem(STORAGE_KEYS.HOME_LAYOUT, JSON.stringify(newLayout));
  }, []);

  const updateTotaisLayout = useCallback(async (newLayout: any[]) => {
    setTotaisLayout(newLayout);
    await AsyncStorage.setItem(STORAGE_KEYS.TOTAIS_LAYOUT, JSON.stringify(newLayout));
  }, []);

  const saveUserSettings = useCallback(async (data: UserSettings) => {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(data));
    setUserSettings(data);
  }, []);

  const calculateAvailableCashForMonth = useCallback((targetMonth: number, targetYear: number) => {
    const currentTotalBalance = accounts.reduce((sum, a) => {
      if (a.type === 'cartao_credito') return sum;

      return sum + a.balance;
    }, 0);

    let projectedRevenues = 0;
    let projectedExpenses = 0;

    // APLICANDO A REGRA DE OURO: Ignorar completamente tudo que já foi pago (pois já está no Saldo Real das contas)
    const pendentes = transactions.filter(tx => tx.paid === false);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    pendentes.forEach(tx => {

      const txDate = financialDate(tx.date);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();

      // Projeta apenas transações que vencem até o final do mês alvo
      if (txYear < targetYear || (txYear === targetYear && txMonth <= targetMonth)) {
        if (tx.type === 'receita') {
          projectedRevenues += tx.amount;
        } else if (tx.type === 'despesa' || tx.type === 'transferencia') {
          // Extra: se a transação pendente for no cartão de crédito, ela não sai do saldo agora, 
          // ela só sai quando a fatura é paga. Mas o usuário quer abater despesas futuras do banco.
          // Como as faturas de cartão viram despesas na conta corrente, podemos ou não abater aqui. 
          // Para segurança máxima do orçamento base zero, consideramos a despesa.
          projectedExpenses += tx.amount;
        }
      }
    });

    const monthsAccumulated = (targetYear - currentYear) * 12 + (targetMonth - currentMonth) + 1;
    const validMonthsAccumulated = Math.max(1, monthsAccumulated); // Proteção contra meses passados

    const totalDailyAllowance = userSettings.dailyAllowance * validMonthsAccumulated;
    const totalSafetyMargin = userSettings.safetyMargin * validMonthsAccumulated;

    const rawEndBalance = currentTotalBalance + projectedRevenues - projectedExpenses;
    const available = rawEndBalance - totalDailyAllowance - totalSafetyMargin;

    return Math.max(available, 0);
  }, [accounts, transactions, userSettings]);

  const getMonthBreakdown = useCallback((targetMonth: number, targetYear: number) => {
    const currentTotalBalance = accounts.reduce((sum, a) => {
      if (a.type === 'cartao_credito') return sum;

      return sum + a.balance;
    }, 0);

    let projectedRevenues = 0;
    let projectedExpenses = 0;

    const pendentes = transactions.filter(tx => tx.paid === false);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    pendentes.forEach(tx => {

      const txDate = financialDate(tx.date);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();

      if (txYear < targetYear || (txYear === targetYear && txMonth <= targetMonth)) {
        if (tx.type === 'receita') {
          projectedRevenues += tx.amount;
        } else if (tx.type === 'despesa' || tx.type === 'transferencia') {
          projectedExpenses += tx.amount;
        }
      }
    });

    const monthsAccumulated = (targetYear - currentYear) * 12 + (targetMonth - currentMonth) + 1;
    const validMonthsAccumulated = Math.max(1, monthsAccumulated);

    const totalDailyAllowance = userSettings.dailyAllowance * validMonthsAccumulated;
    const totalSafetyMargin = userSettings.safetyMargin * validMonthsAccumulated;

    const rawEndBalance = currentTotalBalance + projectedRevenues - projectedExpenses;
    const rawAvailable = rawEndBalance - totalDailyAllowance - totalSafetyMargin;

    return {
      initialBalance: currentTotalBalance,
      projectedRevenues,
      projectedExpenses,
      totalDailyAllowance,
      totalSafetyMargin,
      rawAvailable
    };
  }, [accounts, transactions, userSettings]);



  const calculateAvailableCash = useCallback(() => {
    const now = new Date();
    return calculateAvailableCashForMonth(now.getMonth(), now.getFullYear());
  }, [calculateAvailableCashForMonth]);

  const updateUserSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const updated = { ...userSettings, ...updates };
    await saveUserSettings(updated);
  }, [userSettings, saveUserSettings]);



  // --- DEMAIS MÉTODOS ---

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify(true));
    setHasSeenOnboarding(true);
  }, []);
  const addAccount = useCallback(
    async (acc: Account) => {
      const updatedAccounts = [...accounts, acc];
      await saveAccounts(updatedAccounts);

      if (acc.type !== "cartao_credito" && acc.balance !== 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, transactions, saveAccounts, saveTransactions, notificationPreferences],
  );

  const updateAccount = useCallback(
    async (updatedAcc: Account, skipAdjustment = false) => {
      const oldAcc = accounts.find((a) => a.id === updatedAcc.id);
      if (!oldAcc) return;

      let finalTransactions = transactions;
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
        finalTransactions = [adjustmentTx, ...transactions];
        await saveTransactions(finalTransactions);
      }

      const updatedAccounts = accounts.map((a) =>
        a.id === updatedAcc.id ? updatedAcc : a,
      );
      await syncBalances(finalTransactions, updatedAccounts);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, transactions, saveTransactions, syncBalances, notificationPreferences],
  );

  const deleteAccount = useCallback(
    async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const targetAcc = accounts.find(a => a.id === id);

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
      await recoverPendingRestore();
      const [
        txRaw,
        accRaw,
        budgetsRaw,
        showPendingRaw,
        tagsRaw,
        onboardingRaw,
        projectsRaw,
        notifPrefsRaw,
        goalsRaw,
        homeLayoutRaw,
        totaisLayoutRaw,
        userSettingsRaw
      ] = await AsyncStorage.multiGet([
          STORAGE_KEYS.TRANSACTIONS,
          STORAGE_KEYS.ACCOUNTS,
          STORAGE_KEYS.MONTHLY_BUDGETS,
          STORAGE_KEYS.SHOW_PENDING,
          STORAGE_KEYS.TAGS,
          STORAGE_KEYS.ONBOARDING,
          STORAGE_KEYS.PROJECTS,
          STORAGE_KEYS.NOTIFICATION_PREFS,
          STORAGE_KEYS.GOALS,
          STORAGE_KEYS.HOME_LAYOUT,
          STORAGE_KEYS.TOTAIS_LAYOUT,
          STORAGE_KEYS.USER_SETTINGS,
        ]);

      const loadedTransactions = txRaw[1] ? JSON.parse(txRaw[1]) : DEFAULT_TRANSACTIONS;
      const loadedAccounts = accRaw[1] ? JSON.parse(accRaw[1]) : DEFAULT_ACCOUNTS;
      const loadedTags = tagsRaw[1] ? JSON.parse(tagsRaw[1]) : DEFAULT_TAGS;
      const loadedProjects = projectsRaw[1] ? JSON.parse(projectsRaw[1]) : [];
      const loadedGoals = goalsRaw[1] ? JSON.parse(goalsRaw[1]) : [];

      setTransactions(loadedTransactions);
      setAccounts(loadedAccounts);
      setTags(loadedTags);
      setProjects(loadedProjects);
      setGoals(loadedGoals);
      setMonthlyBudgets(budgetsRaw[1] ? JSON.parse(budgetsRaw[1]) : {});
      setHasSeenOnboarding(onboardingRaw[1] ? JSON.parse(onboardingRaw[1]) : false);

      if (showPendingRaw[1] !== null) {
        setShowPendingState(JSON.parse(showPendingRaw[1]));
      }

      if (notifPrefsRaw[1] !== null) {
      const prefs = JSON.parse(notifPrefsRaw[1]);
      setNotificationPreferences(prefs);
      // Schedule notifications based on loaded preferences
      if (prefs.dailyReminders) {
        NotificationService.scheduleDailyReminder(prefs.dailyReminderTime.hour, prefs.dailyReminderTime.minute);
      }
      if (prefs.expenseReminders) {
        NotificationService.scheduleExpenseReminder(prefs.expenseReminderTime.hour, prefs.expenseReminderTime.minute);
      }
      if (prefs.creditCardAlerts) {
        NotificationService.scheduleCreditCardAlert(prefs.creditCardAlertTime.hour, prefs.creditCardAlertTime.minute);
      }
    }

      if (homeLayoutRaw[1] !== null) {
        setHomeLayout(JSON.parse(homeLayoutRaw[1]));
      }

      if (totaisLayoutRaw && totaisLayoutRaw[1] !== null) {
        setTotaisLayout(JSON.parse(totaisLayoutRaw[1]));
      }



      if (userSettingsRaw && userSettingsRaw[1] !== null) {
        setUserSettings(JSON.parse(userSettingsRaw[1]));
      }

      // Notificações agora são apenas agendadas quando a preferência é alterada pelo usuário.
      // Removido o reagendamento forçado na inicialização para evitar notificações indesejadas no boot.

      // Vencimento não confirma pagamento. Reconstrói somente o saldo realizado.
      await syncBalances(loadedTransactions, loadedAccounts);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  }, [syncBalances]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const restoreBackup = useCallback(async (input: unknown) => {
    const data = await restoreBackupStorage(input);
    setTransactions(data.transactions);
    setAccounts(data.accounts);
    setTags(data.tags);
    setProjects(data.projects);
    setGoals(data.goals);
    setMonthlyBudgets(data.monthlyBudgets);
    setShowPendingState(data.showPending);
    setHasSeenOnboarding(data.hasSeenOnboarding);
    setNotificationPreferences(data.notificationPreferences);
    setHomeLayout(data.homeLayout);
    setTotaisLayout(data.totaisLayout);
    setUserSettings(data.userSettings);
    const prefs = data.notificationPreferences;
    // Identificadores de notificações pertencem ao dispositivo, não ao backup.
    try {
      await Promise.all([
        prefs.dailyReminders ? NotificationService.scheduleDailyReminder(prefs.dailyReminderTime.hour, prefs.dailyReminderTime.minute) : NotificationService.cancelDailyReminder(),
        prefs.expenseReminders ? NotificationService.scheduleExpenseReminder(prefs.expenseReminderTime.hour, prefs.expenseReminderTime.minute) : NotificationService.cancelExpenseReminder(),
        prefs.creditCardAlerts ? NotificationService.scheduleCreditCardAlert(prefs.creditCardAlertTime.hour, prefs.creditCardAlertTime.minute) : NotificationService.cancelCreditCardAlert(),
      ]);
    } catch (error) {
      console.warn('Dados restaurados, mas não foi possível atualizar os lembretes.', error);
    }
    return data;
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
      STORAGE_KEYS.GOALS,
      STORAGE_KEYS.HOME_LAYOUT,
      STORAGE_KEYS.TOTAIS_LAYOUT,
      STORAGE_KEYS.USER_SETTINGS,
    ]);
    setTransactions(DEFAULT_TRANSACTIONS);
    setAccounts(DEFAULT_ACCOUNTS);
    setTags(DEFAULT_TAGS);
    setProjects([]);
    setGoals([]);
    setMonthlyBudgets({});
    setShowPendingState(true);
    setHasSeenOnboarding(false);
    setNotificationPreferences(DEFAULT_NOTIFICATION_PREFS);
    setHomeLayout([
      { id: 'balance', visible: true },
      { id: 'accounts', visible: true },
      { id: 'projects', visible: true },
      { id: 'goals', visible: true },
      { id: 'transactions', visible: true },
    ]);
    setTotaisLayout([
      { id: 'stats', visible: true },
      { id: 'category', visible: true },
      { id: 'period', visible: true },
    ]);
    setUserSettings(DEFAULT_USER_SETTINGS);
  }, []);

  const setShowPending = useCallback(async (value: boolean) => {
    setShowPendingState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.SHOW_PENDING, JSON.stringify(value));
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
        const parts = dayKey(tx.date).split('-').map(Number);
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
        const parts = dayKey(tx.date).split('-').map(Number);
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
            case 'dias_uteis': {
              let d = new Date(baseDate);
              let added = 0;
              while (added < i) {
                d.setDate(d.getDate() + 1);
                const dayOfWeek = d.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                  added++;
                }
              }
              effectiveDate = d;
              break;
            }
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

          const hojeFiltro = new Date();
          hojeFiltro.setHours(0, 0, 0, 0);
          const isFuture = effectiveDate > hojeFiltro;

          const isPaid = isCreditCard ? false : (i === 0 ? (isFuture ? false : tx.paid) : false);

          newTransactions.push({
            ...tx,
            id: `${baseId}-${i}`,
            groupId: baseId,
            groupIndex: i,
            date: effectiveDate.toISOString(),
            paid: isPaid,
            paymentMethod: finalizedTxMethod,
          });
        }
      }
      else {

        const newTx: Transaction = {
          ...tx,
          id: Date.now().toString(),
          paymentMethod: finalizedTxMethod,
          paid: isCreditCard ? false : tx.paid,
        };
        newTransactions.push(newTx);
      }

      const updated = [...newTransactions, ...transactions];
      await saveTransactions(updated);
      await syncBalances(updated, accounts);
      return newTransactions[0];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, accounts, saveTransactions, syncBalances, notificationPreferences],
  );

  const deleteTransaction = useCallback(
    async (id: string, mode: 'single' | 'future' | 'all' = 'single') => {
      const targetTx = transactions.find((t) => t.id === id);
      if (!targetTx) return;

      let idsToDelete = [id];
      const isPartOfFamily = targetTx.groupId || (/^\d+-\d+$/.test(id) && (targetTx.totalInstallments || targetTx.recurrence !== 'unica'));

      if (isPartOfFamily && mode !== 'single') {
        const baseId = targetTx.groupId || id.split('-')[0];
        const familyTxs = transactions.filter(t => t.groupId === baseId || t.id.startsWith(`${baseId}-`));
        if (mode === 'all') {
          idsToDelete = familyTxs.map(t => t.id);
        } else if (mode === 'future') {
          const targetDateStr = dayKey(targetTx.date);
          idsToDelete = familyTxs.filter(t => dayKey(t.date) >= targetDateStr).map(t => t.id);
        }
      }

      if (transactions.some(t => idsToDelete.includes(t.id) && (t.cardPaymentId || t.settledByPaymentId))) throw new Error('Estorne o registro na tela Cartões antes de excluir.');
      const updated = transactions.filter((t) => !idsToDelete.includes(t.id));

      await saveTransactions(updated);
      await syncBalances(updated, accounts);
    },
    [transactions, accounts, saveTransactions, syncBalances],
  );

  const updateTransaction = useCallback(
    async (updatedTx: Transaction, mode: 'single' | 'future' | 'all' = 'single') => {
      const oldTx = transactions.find((t) => t.id === updatedTx.id);
      if (!oldTx) return;
      if (oldTx.cardPaymentId || oldTx.settledByPaymentId) throw new Error('Estorne o registro na tela Cartões antes de editar.');

      let finalTransactions = [...transactions];
      const isPartOfFamily = oldTx.groupId || (/^\d+-\d+$/.test(oldTx.id) && (oldTx.totalInstallments || oldTx.recurrence !== 'unica'));

      if (isPartOfFamily && mode !== 'single') {
        const baseId = oldTx.groupId || oldTx.id.split('-')[0];
        const familyTxs = transactions.filter(t => t.groupId === baseId || t.id.startsWith(`${baseId}-`));
        const targetDateStr = dayKey(oldTx.date);
        const txsToMutate = mode === 'all' ? familyTxs : familyTxs.filter(t => dayKey(t.date) >= targetDateStr);

        if (txsToMutate.some(t => t.cardPaymentId || t.settledByPaymentId)) throw new Error('A família contém registros de pagamento. Estorne antes de editar.');
        const targetAccount = accounts.find(a => a.id === updatedTx.accountId);
        const isCreditCard = targetAccount?.type === 'cartao_credito';
        const closingDay = targetAccount?.closingDay || 25;
        const dueDay = targetAccount?.dueDay || 5;

        const parts = dayKey(updatedTx.date).split('-').map(Number);
        const newBaseDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        const refIndex = oldTx.groupIndex || 0;

        let baseM = newBaseDate.getMonth() + 1;
        let baseY = newBaseDate.getFullYear();
        if (isCreditCard) {
            if (newBaseDate.getDate() >= closingDay) baseM += 1;
            if (dueDay < closingDay) baseM += 1;
        }

        for (const mutantOld of txsToMutate) {
          const indexDiff = (mutantOld.groupIndex || 0) - refIndex;
          let currentDate = new Date(newBaseDate);

          if (isCreditCard && updatedTx.totalInstallments && updatedTx.totalInstallments > 1) {
             if (indexDiff === 0) {
                 currentDate = new Date(newBaseDate);
             } else {
                 let targetInvM = baseM + indexDiff;
                 let monthForDay1 = targetInvM - (dueDay < closingDay ? 1 : 0);
                 currentDate = new Date(baseY, monthForDay1 - 1, 1, 12, 0, 0);
             }
          } else {
             switch (updatedTx.recurrence) {
                case 'mensal':
                  currentDate = addMonths(newBaseDate, indexDiff);
                  break;
                case 'anual':
                  currentDate = addYears(newBaseDate, indexDiff);
                  break;
                case 'semanal':
                  currentDate = addWeeks(newBaseDate, indexDiff);
                  break;
                case 'diaria':
                  currentDate = addDays(newBaseDate, indexDiff);
                  break;
                case 'dias_uteis': {
                  let d = new Date(newBaseDate);
                  let added = 0;
                  const step = indexDiff > 0 ? 1 : -1;
                  const targetAdded = Math.abs(indexDiff);
                  while (added < targetAdded) {
                    d.setDate(d.getDate() + step);
                    const dayOfWeek = d.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                      added++;
                    }
                  }
                  currentDate = d;
                  break;
                }
                case 'quinto_dia_util': {
                  const targetMonthDate = addMonths(newBaseDate, indexDiff);
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
                  currentDate = new Date(targetYear, targetMonth, day, 12, 0, 0);
                  break;
                }
                default:
                  currentDate = addMonths(newBaseDate, indexDiff);
             }
          }

          let finalDescription = updatedTx.description;
          if (updatedTx.totalInstallments && updatedTx.totalInstallments > 1) {
             const cleanDesc = updatedTx.description.replace(/\s\(\d+\/\d+\)$/, "");
             finalDescription = `${cleanDesc} (${(mutantOld.groupIndex || 0) + 1}/${updatedTx.totalInstallments})`;
          }

          const mutantNew = { 
            ...updatedTx, 
            id: mutantOld.id, 
            groupId: mutantOld.groupId, 
            groupIndex: mutantOld.groupIndex, 
            paid: mutantOld.paid,
            date: currentDate.toISOString(),
            description: finalDescription
          };
          finalTransactions = finalTransactions.map(t => t.id === mutantNew.id ? mutantNew : t);
        }
      } else {
        // Merge: preservar campos de família e metadados do oldTx que não vêm do formulário
        const targetAccount = accounts.find(a => a.id === (updatedTx.accountId || oldTx.accountId));
        const isCreditCard = targetAccount?.type === 'cartao_credito';
        // Vínculos enviados como undefined são remoções explícitas; campos ausentes são preservados.
        const cleanedUpdatedTx = Object.fromEntries(
          Object.entries(updatedTx).filter(([key, value]) =>
            value !== undefined || ['projectId', 'goalIds', 'targetAccountId'].includes(key)
          )
        );
        const mergedTx = {
          ...oldTx,
          ...cleanedUpdatedTx,
          // Preservar metadados de família
          groupId: oldTx.groupId,
          groupIndex: oldTx.groupIndex,
          notificationId: (oldTx as any).notificationId,
          notifyRecurrence: oldTx.notifyRecurrence,
          // Para cartão de crédito, preservar o status paid original
          paid: isCreditCard ? oldTx.paid : updatedTx.paid,
        };
        finalTransactions = finalTransactions.map(t => t.id === mergedTx.id ? mergedTx : t);
      }

      await saveTransactions(finalTransactions);
      await syncBalances(finalTransactions, accounts);
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

  const totalBalance = financialIndex.totalBalance;

  const recordCardPayment = useCallback(async (request: CardPaymentRequest) => {
    if (cardWriteLock.current) throw new Error('Um pagamento já está sendo processado.');
    cardWriteLock.current = true;
    try {
      const next = prepareCardPayment(accounts, transactionsRef.current, request);
      const updatedAccounts = calculateAccountBalances(accounts, next);
      await commitLedger(next, updatedAccounts);
      transactionsRef.current = next;
      setTransactions(next); setAccounts(updatedAccounts);
    } finally { cardWriteLock.current = false; }
  }, [accounts]);
  const reverseCardPayment = useCallback(async (paymentId: string) => {
    if (cardWriteLock.current) throw new Error('Aguarde a gravação atual.');
    cardWriteLock.current = true;
    try {
      const next = reverseRecordedPayment(transactionsRef.current, paymentId);
      const updatedAccounts = calculateAccountBalances(accounts, next);
      await commitLedger(next, updatedAccounts);
      transactionsRef.current = next; setTransactions(next); setAccounts(updatedAccounts);
    } finally { cardWriteLock.current = false; }
  }, [accounts]);
  const payCreditCardInvoice = useCallback(async (creditCardId: string, sourceAccountId: string | null, targetMonth: number, targetYear: number, gerarLancamento = true, paymentDate = new Date()) => {
    await recordCardPayment({ cardId: creditCardId, sourceId: sourceAccountId, month: dayKey(new Date(targetYear, targetMonth, 1, 12)).slice(0,7), markOnly: !gerarLancamento, date: paymentDate });
  }, [recordCardPayment]);
  const anticipateCreditCardPayment = useCallback(async (creditCardId: string, sourceAccountId: string, amount: number, targetMonth: number, targetYear: number, paymentDate = new Date()) => {
    await recordCardPayment({ cardId: creditCardId, sourceId: sourceAccountId, month: dayKey(new Date(targetYear, targetMonth, 1, 12)).slice(0,7), amount, date: paymentDate });
  }, [recordCardPayment]);

  const deleteMultipleTransactions = useCallback(
    async (txIds: string[], scope: 'invoice' | 'family' = 'invoice') => {
      if (transactions.some(t => txIds.includes(t.id) && (t.cardPaymentId || t.settledByPaymentId))) throw new Error('Esta seleção contém pagamentos vinculados. Preserve os registros para manter a conciliação.');
      let idsToRemove = new Set<string>();

      txIds.forEach((id) => {
        const targetTx = transactions.find((t) => t.id === id);
        if (!targetTx) return;

        idsToRemove.add(id);
        const isPartOfFamily = targetTx.groupId || (/^\d+-\d+$/.test(id) && (targetTx.totalInstallments || targetTx.recurrence !== 'unica'));

        if (scope === 'family' && isPartOfFamily) {
          const baseId = targetTx.groupId || id.split('-')[0];
          const familyTxs = transactions.filter(
            (t) => t.groupId === baseId || t.id.startsWith(`${baseId}-`)
          );
          familyTxs.forEach((t) => idsToRemove.add(t.id));
        }
      });


      if (transactions.some(t => idsToRemove.has(t.id) && (t.cardPaymentId || t.settledByPaymentId))) throw new Error('A família contém pagamentos vinculados.');
      const updated = transactions.filter((t) => !idsToRemove.has(t.id));

      await saveTransactions(updated);
      await syncBalances(updated, accounts);
    },
    [transactions, accounts, saveTransactions, syncBalances],
  );

  const purgeAdjustments = useCallback(async () => {
    const updatedTxs = transactions.filter((tx) => !tx.isAdjustment);
    await saveTransactions(updatedTxs);
    await syncBalances(updatedTxs, accounts);
  }, [transactions, accounts, saveTransactions, syncBalances]);

  const getProjectStats = useCallback((projectId: string) => {
    const stats = financialIndex.projects.get(projectId) || EMPTY_PROJECT;
    return { income: stats.income, spent: stats.spent, available: stats.available };
  }, [financialIndex]);
  const getProjectSpent = useCallback((projectId: string) => getProjectStats(projectId).spent, [getProjectStats]);
  const getGoalSavedAmount = useCallback((goalId: string) => financialIndex.goalAmounts.get(goalId) || 0, [financialIndex]);
  const getInvoicePendingForMonth = useCallback((creditCardId: string, targetMonth: number, targetYear: number) => {
    const month = dayKey(new Date(targetYear, targetMonth, 1, 12)).slice(0,7);
    return (financialIndex.cardIndex.invoices.get(creditCardId + ':' + month)?.pending || 0) / 100;
  }, [financialIndex]);
  const getInvoiceTotalForMonth = useCallback((creditCardId: string, targetMonth: number, targetYear: number) => {
    const card = financialIndex.accountById.get(creditCardId);
    return card ? getInvoiceTotal(card, transactions, targetMonth, targetYear) : 0;
  }, [financialIndex, transactions]);
  return {
    financialIndex,
    today,
    restoreBackup,
    notificationPreferences,
    toggleNotificationPreference,
    updateNotificationTime,
    transactions,
    accounts,
    projects,
    addProject,
    updateProject,
    deleteProject,
    getProjectSpent,
    getProjectStats,
    getInvoicePendingForMonth,
    getInvoiceTotalForMonth,
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    getGoalSavedAmount,
    tags,
    addTag,
    updateTag,
    deleteTag,
    monthlyBudgets,
    getEffectiveBudget,
    saveMonthlyBudget,
    showPending,
    setShowPending,
    hasSeenOnboarding,
    completeOnboarding,
    totalBalance,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    setPrimaryAccount,
    syncBalances,
    purgeAdjustments,
    clearAllData,
    reverseCardPayment,
    payCreditCardInvoice,
    anticipateCreditCardPayment,
    deleteMultipleTransactions,
    homeLayout,
    updateHomeLayout,
    totaisLayout,
    updateTotaisLayout,


    calculateAvailableCash,
    calculateAvailableCashForMonth,
    getMonthBreakdown,

    userSettings,
    updateUserSettings,
    loading,
  };
}
