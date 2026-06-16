// hooks/useStore.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Account, Tag, DEFAULT_TAGS, Project, NotificationPreferences, WishlistItem, UserSettings, PaymentPreference } from '@/constants/types';
import * as NotificationService from '../services/notificationService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { addMonths, addYears, addWeeks, addDays, setDate } from 'date-fns';
import { getInvoiceForTx } from '@/lib/utils';

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
  WISHLIST: '@horizonte:wishlist',
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
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

  // --- MÉTODOS PARA WISHLIST ---

  const saveWishlist = useCallback(async (data: WishlistItem[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(data));
    setWishlist(data);
  }, []);

  const saveUserSettings = useCallback(async (data: UserSettings) => {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(data));
    setUserSettings(data);
  }, []);

  const addWishlistItem = useCallback(async (item: Omit<WishlistItem, 'id' | 'status' | 'createdAt'>) => {
    const newItem: WishlistItem = {
      ...item,
      id: Date.now().toString(),
      status: 'PENDENTE',
      createdAt: new Date().toISOString(),
    };
    const updated = [...wishlist, newItem];
    await saveWishlist(updated);
  }, [wishlist, saveWishlist]);

  const editWishlistItem = useCallback(async (updatedItem: WishlistItem) => {
    const updated = wishlist.map(i => i.id === updatedItem.id ? updatedItem : i);
    await saveWishlist(updated);
  }, [wishlist, saveWishlist]);

  const deleteWishlistItem = useCallback(async (id: string) => {
    const updated = wishlist.filter(i => i.id !== id);
    await saveWishlist(updated);
  }, [wishlist, saveWishlist]);

  const markAsBought = useCallback(async (id: string) => {
    const updated = wishlist.map(i =>
      i.id === id ? { ...i, status: 'COMPRADO' as const } : i
    );
    await saveWishlist(updated);
  }, [wishlist, saveWishlist]);

  const calculateAvailableCashForMonth = useCallback((targetMonth: number, targetYear: number) => {
    const currentTotalBalance = accounts.reduce((sum, a) => {
      if (a.type === 'cartao_credito') return sum;
      
      const isIncluded = userSettings.simulatorIncludedAccounts 
        ? userSettings.simulatorIncludedAccounts.includes(a.id)
        : true;
        
      if (!isIncluded) return sum;

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
      const isAccountIncluded = userSettings.simulatorIncludedAccounts 
        ? userSettings.simulatorIncludedAccounts.includes(tx.accountId)
        : true;

      if (!isAccountIncluded) return;

      const txDate = new Date(tx.date);
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
      
      const isIncluded = userSettings.simulatorIncludedAccounts 
        ? userSettings.simulatorIncludedAccounts.includes(a.id)
        : true;
        
      if (!isIncluded) return sum;

      return sum + a.balance;
    }, 0);

    let projectedRevenues = 0;
    let projectedExpenses = 0;

    const pendentes = transactions.filter(tx => tx.paid === false);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    pendentes.forEach(tx => {
      const isAccountIncluded = userSettings.simulatorIncludedAccounts 
        ? userSettings.simulatorIncludedAccounts.includes(tx.accountId)
        : true;

      if (!isAccountIncluded) return;

      const txDate = new Date(tx.date);
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

  const evaluateItemAffordability = useCallback((itemPrice: number | string, preference: PaymentPreference = 'QUALQUER', userInstallments?: number) => {
    // Higienizador: Remove 'R$', espaços, converte vírgula para ponto e faz o parse seguro
    const cleanPrice = (val: number | string): number => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const cleanedString = String(val).replace(/[R$\s]/g, '').replace(',', '.');
      return Number(cleanedString) || 0;
    };
    
    const price = cleanPrice(itemPrice);

    // LOG DE SEGURANÇA
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentAvailable = calculateAvailableCashForMonth(currentMonth, currentYear);
  
    // 1. Dinheiro Livre Agora (A_VISTA)
    if (preference !== 'CREDITO' && price <= currentAvailable) {
      return {
        status: 'VERDE',
        suggestedMethod: 'A_VISTA',
        suggestedMessage: 'Dinheiro disponível. Pode comprar no PIX ou Débito.',
        bestFutureMonth: currentMonth,
        currentAvailable
      };
    }
  
    // --- TRAVA COMPORTAMENTAL: TETO DE FATURA ---
    const maxCreditSpend = userSettings.maxMonthlyCreditSpend !== undefined && userSettings.maxMonthlyCreditSpend > 0 
      ? userSettings.maxMonthlyCreditSpend 
      : Infinity;

    const creditSafetyMargin = userSettings.creditSafetyMargin || 0;
    const effectiveMaxCreditSpend = maxCreditSpend === Infinity ? Infinity : maxCreditSpend - creditSafetyMargin;

    const creditCardIds = accounts.filter(a => a.type === 'cartao_credito').map(c => c.id);

    // Lógica para virada de mês/ano segura
    let nextMonth = currentMonth + 1;
    let nextMonthYear = currentYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      nextMonthYear++;
    }

    const getCreditBillForMonth = (targetMonth: number, targetYear: number) => {
      let total = 0;
      transactions.forEach(tx => {
        if (!tx.paid && tx.type !== 'receita' && creditCardIds.includes(tx.accountId)) {
          const account = accounts.find(a => a.id === tx.accountId);
          if (account) {
            const invoice = getInvoiceForTx(tx.date, account);
            if (invoice.viewMonth === targetMonth && invoice.viewYear === targetYear) {
              total += tx.amount;
            }
          }
        }
      });
      return total;
    };

    const getCreditBillTransactionsForMonth = (targetMonth: number, targetYear: number) => {
      return transactions.filter(tx => {
        if (!tx.paid && tx.type !== 'receita' && creditCardIds.includes(tx.accountId)) {
          const account = accounts.find(a => a.id === tx.accountId);
          if (account) {
            const invoice = getInvoiceForTx(tx.date, account);
            return invoice.viewMonth === targetMonth && invoice.viewYear === targetYear;
          }
        }
        return false;
      });
    };

    // Cartão representativo para mapear datas de compra → mês real da fatura
    const representativeCard = accounts.find(a => a.type === 'cartao_credito') || { closingDay: 25, dueDay: 5 };

    const currentMonthBill = getCreditBillForMonth(currentMonth, currentYear);
  
    // 2. Cartão de Crédito (CARTAO_1X) - Verifica Fluxo E Limite (apenas para QUALQUER)
    if (preference === 'QUALQUER') {
      // Mapeia a compra de hoje para a fatura real usando closingDay/dueDay
      const todayInvoice = getInvoiceForTx(now.toISOString(), representativeCard);
      const invoiceMonth1x = todayInvoice.viewMonth;
      const invoiceYear1x = todayInvoice.viewYear;
      const invoiceBill1x = getCreditBillForMonth(invoiceMonth1x, invoiceYear1x);
      const invoiceAvailable1x = calculateAvailableCashForMonth(invoiceMonth1x, invoiceYear1x);

      if (price <= invoiceAvailable1x && (price + invoiceBill1x) <= effectiveMaxCreditSpend) {
        return {
          status: 'VERDE',
          suggestedMethod: 'CARTAO_1X',
          suggestedMessage: 'Compre no Crédito hoje em 1x. Seu fluxo de caixa cobre a fatura.',
          bestFutureMonth: invoiceMonth1x,
          currentAvailable,
          creditData: { maxCreditSpend, creditSafetyMargin, currentMonthBill: invoiceBill1x, installmentValue: price, installments: 1, effectiveMaxCreditSpend, billTransactions: getCreditBillTransactionsForMonth(invoiceMonth1x, invoiceYear1x) }
        };
      }
    }
  
    // 3. Lógica específica para quando o usuário escolhe CREDITO
    if (preference === 'CREDITO') {
      const installments = userInstallments && userInstallments >= 2 ? userInstallments : 2;
      const installmentValue = price / installments;
      
      let bestFutureMonthForInstallments: number | undefined;
      let bestFutureYearForInstallments: number | undefined;
      let startOffsetThatWorked = -1;

      for (let startOffset = 0; startOffset <= 24; startOffset++) {
        let isSafe = true;
        for (let i = 0; i < installments; i++) {
          // Simula a data em que a parcela i seria cobrada no cartão
          const simulatedChargeDate = new Date(currentYear, currentMonth + startOffset + i, now.getDate(), 12, 0, 0);
          const invoiceInfo = getInvoiceForTx(simulatedChargeDate.toISOString(), representativeCard);
          const m = invoiceInfo.viewMonth;
          const y = invoiceInfo.viewYear;
          
          const monthBill = getCreditBillForMonth(m, y);
          if ((installmentValue + monthBill) > effectiveMaxCreditSpend) {
            isSafe = false;
            break;
          }

          const monthAvailable = calculateAvailableCashForMonth(m, y);
          const accumulatedInstallmentCost = installmentValue * (i + 1);
  
          if (accumulatedInstallmentCost > monthAvailable) {
            isSafe = false;
            break;
          }
        }

        if (isSafe) {
          let computedMonth = currentMonth + startOffset;
          let computedYear = currentYear;
          while (computedMonth > 11) {
            computedMonth -= 12;
            computedYear++;
          }
          bestFutureMonthForInstallments = computedMonth;
          bestFutureYearForInstallments = computedYear;
          startOffsetThatWorked = startOffset;
          break;
        }
      }

      if (startOffsetThatWorked === 0) {
        return {
          status: 'VERDE',
          suggestedMethod: 'PARCELADO',
          suggestedMessage: `Pode comprar hoje parcelado em ${installments}x de R$ ${installmentValue.toFixed(2)} com total segurança.`,
          bestFutureMonth: currentMonth,
          currentAvailable,
          creditData: { maxCreditSpend, creditSafetyMargin, currentMonthBill, installmentValue, installments, effectiveMaxCreditSpend, billTransactions: getCreditBillTransactionsForMonth(currentMonth, currentYear) }
        };
      } else if (startOffsetThatWorked > 0 && bestFutureMonthForInstallments !== undefined && bestFutureYearForInstallments !== undefined) {
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return {
          status: 'AMARELO',
          suggestedMethod: 'PARCELADO',
          suggestedMessage: `Aguarde para comprar no cartão em ${monthNames[bestFutureMonthForInstallments]} de ${bestFutureYearForInstallments}. Assim, as parcelas de ${installments}x ficarão seguras.`,
          bestFutureMonth: bestFutureMonthForInstallments,
          currentAvailable,
          creditData: { maxCreditSpend, creditSafetyMargin, currentMonthBill: getCreditBillForMonth(bestFutureMonthForInstallments, bestFutureYearForInstallments), installmentValue, installments, effectiveMaxCreditSpend, billTransactions: getCreditBillTransactionsForMonth(bestFutureMonthForInstallments, bestFutureYearForInstallments) }
        };
      } else {
        return {
          status: 'VERMELHO',
          suggestedMethod: 'CREDITO_RECUSADO',
          suggestedMessage: `Parcelamento recusado. O valor de ${installments}x estoura o seu Teto do Cartão mensal (já descontada a margem) ou o seu fluxo de caixa não comporta essas parcelas nem mesmo no futuro.`,
          bestFutureMonth: undefined,
          currentAvailable,
          creditData: { maxCreditSpend, creditSafetyMargin, currentMonthBill, installmentValue, installments, effectiveMaxCreditSpend, billTransactions: getCreditBillTransactionsForMonth(currentMonth, currentYear) }
        };
      }
    }

    // 4. Parcelamento Seguro Automático (apenas para QUALQUER)
    let canInstallment = false;
    let bestInstallments = 0;
    let bestInstallmentValue = 0;
  
    if (preference === 'QUALQUER') {
      for (let parcels = 2; parcels <= 12; parcels++) {
        const installmentValue = price / parcels;
        let isSafe = true;
        
        for (let i = 0; i < parcels; i++) {
          // Simula a data em que a parcela i seria cobrada no cartão
          const simulatedChargeDate = new Date(currentYear, currentMonth + i, now.getDate(), 12, 0, 0);
          const invoiceInfo = getInvoiceForTx(simulatedChargeDate.toISOString(), representativeCard);
          const m = invoiceInfo.viewMonth;
          const y = invoiceInfo.viewYear;
          
          const monthBill = getCreditBillForMonth(m, y);
          if ((installmentValue + monthBill) > effectiveMaxCreditSpend) {
            isSafe = false;
            break;
          }

          const monthAvailable = calculateAvailableCashForMonth(m, y);
          const accumulatedInstallmentCost = installmentValue * (i + 1);
  
          if (accumulatedInstallmentCost > monthAvailable) {
            isSafe = false;
            break;
          }
        }
  
        if (isSafe) {
          canInstallment = true;
          bestInstallments = parcels;
          bestInstallmentValue = installmentValue;
          break;
        }
      }
    }
  
    if (canInstallment) {
      return {
        status: 'AMARELO',
        suggestedMethod: 'PARCELADO',
        suggestedMessage: `Pode ser parcelado de forma segura hoje em até ${bestInstallments}x de R$ ${bestInstallmentValue.toFixed(2)}.`,
        bestFutureMonth: undefined,
        currentAvailable
      };
    }
  
    // 5. Necessidade de Poupar (POUPAR) para compra à vista (usado se QUALQUER ou DEBITO falharem hoje)
    let bestFutureMonth: number | undefined;
    let bestFutureYear: number | undefined;
  
    for (let i = 1; i <= 24; i++) { // Projeta até 2 anos
      let m = currentMonth + i;
      let y = currentYear;
      while (m > 11) {
        m -= 12;
        y++;
      }
      const futureAvailable = calculateAvailableCashForMonth(m, y);
      if (price <= futureAvailable) {
        bestFutureMonth = m;
        bestFutureYear = y;
        break;
      }
    }
  
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthText = bestFutureMonth !== undefined ? `${monthNames[bestFutureMonth]} de ${bestFutureYear}` : 'um mês futuro';
  
    return {
      status: 'VERMELHO',
      suggestedMethod: 'POUPAR',
      suggestedMessage: `Sem margem. Guarde dinheiro e compre à vista em ${monthText}.`,
      bestFutureMonth,
      currentAvailable
    };
  }, [calculateAvailableCashForMonth, accounts, transactions, userSettings]);

  const calculateAvailableCash = useCallback(() => {
    const now = new Date();
    return calculateAvailableCashForMonth(now.getMonth(), now.getFullYear());
  }, [calculateAvailableCashForMonth]);

  const updateUserSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const updated = { ...userSettings, ...updates };
    await saveUserSettings(updated);
  }, [userSettings, saveUserSettings]);

  const toggleSimulatorAccount = useCallback((accountId: string) => {
    let currentList = userSettings.simulatorIncludedAccounts;
    if (!currentList) {
      currentList = accounts.filter(a => a.type !== 'cartao_credito').map(a => a.id).filter(id => id !== accountId);
    } else {
      if (currentList.includes(accountId)) {
        currentList = currentList.filter(id => id !== accountId);
      } else {
        currentList = [...currentList, accountId];
      }
    }
    updateUserSettings({ simulatorIncludedAccounts: currentList });
  }, [userSettings.simulatorIncludedAccounts, accounts, updateUserSettings]);

  const selectSimulatorCreditCard = useCallback((accountId: string | null) => {
    updateUserSettings({ simulatorSelectedCreditCardId: accountId });
  }, [updateUserSettings]);

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
        wishlistRaw,
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
          STORAGE_KEYS.WISHLIST,
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
        setNotificationPreferences(JSON.parse(notifPrefsRaw[1]));
      }

      if (homeLayoutRaw[1] !== null) {
        setHomeLayout(JSON.parse(homeLayoutRaw[1]));
      }

      if (totaisLayoutRaw && totaisLayoutRaw[1] !== null) {
        setTotaisLayout(JSON.parse(totaisLayoutRaw[1]));
      }

      if (wishlistRaw && wishlistRaw[1] !== null) {
        setWishlist(JSON.parse(wishlistRaw[1]));
      }

      if (userSettingsRaw && userSettingsRaw[1] !== null) {
        setUserSettings(JSON.parse(userSettingsRaw[1]));
      }

      // Notificações agora são apenas agendadas quando a preferência é alterada pelo usuário.
      // Removido o reagendamento forçado na inicialização para evitar notificações indesejadas no boot.

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
      STORAGE_KEYS.WISHLIST,
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
    setWishlist([]);
    setUserSettings(DEFAULT_USER_SETTINGS);
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

      await saveTransactions(updated);
      await syncBalances(updated, accounts);
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

        const targetAccount = accounts.find(a => a.id === updatedTx.accountId);
        const isCreditCard = targetAccount?.type === 'cartao_credito';
        const closingDay = targetAccount?.closingDay || 25;
        const dueDay = targetAccount?.dueDay || 5;

        const parts = updatedTx.date.split('T')[0].split('-').map(Number);
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
        // Filtrar propriedades undefined do updatedTx para não sobrescrever valores existentes do oldTx
        const cleanedUpdatedTx = Object.fromEntries(
          Object.entries(updatedTx).filter(([_, v]) => v !== undefined)
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
          // Preservar a data original para evitar shifts de timezone na reconstrução
          date: oldTx.date,
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
      await syncBalances(finalTransactions, accounts);
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
      paymentDate?: Date,
    ) => {
      const cardAccount = accounts.find((a) => a.id === creditCardId);
      if (!cardAccount) return;

      const baseId = Date.now().toString();
      const effectiveDate = paymentDate || new Date();

      const paymentTx: Transaction = {
        id: `${baseId}-out`,
        description: `Antecipação - ${cardAccount.name}`,
        amount: amount,
        type: 'despesa',
        date: effectiveDate.toISOString(),
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
      await syncBalances(finalTransactions, accounts);
    },
    [transactions, accounts, saveTransactions, syncBalances],
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

      await saveTransactions(updated);
      await syncBalances(updated, accounts);
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
      if (tx.type === 'despesa' || tx.type === 'transferencia') {
        return sum + amount;
      }
      if (tx.type === 'receita') {
        return sum - amount;
      }
      return sum;
    }, 0);
  }, [transactions]);

  const getGoalSavedAmount = useCallback((goalId: string) => {
    if (!goalId) return 0;
    const goal = goals.find(g => g.id === goalId);
    const baseAmount = goal ? (goal.savedAmount || 0) : 0;

    const goalTxs = transactions.filter(tx => tx.goalIds && tx.goalIds.includes(goalId));
    const txsAmount = goalTxs.reduce((sum, tx) => {
      // Considera todas as transações atreladas à meta como aporte (geralmente transferências ou despesas voltadas pra meta)
      return sum + (Number(tx.amount) || 0);
    }, 0);

    return baseAmount + txsAmount;
  }, [transactions, goals]);

  const getInvoiceTotalForMonth = useCallback((creditCardId: string, targetMonth: number, targetYear: number) => {
    const cardAccount = accounts.find((a) => a.id === creditCardId);
    if (!cardAccount || cardAccount.type !== 'cartao_credito') return 0;
  
    const closingDay = cardAccount.closingDay || 25;
    const dueDay = cardAccount.dueDay || 5;
    let invoiceTotal = 0;
  
    transactions.forEach((tx) => {
      if (tx.accountId !== creditCardId || tx.paymentMethod !== 'credito') return;
  
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
    projects,
    addProject,
    updateProject,
    deleteProject,
    getProjectSpent,
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
    payCreditCardInvoice,
    anticipateCreditCardPayment,
    deleteMultipleTransactions,
    homeLayout,
    updateHomeLayout,
    totaisLayout,
    updateTotaisLayout,
    wishlist,
    addWishlistItem,
    editWishlistItem,
    deleteWishlistItem,
    markAsBought,
    calculateAvailableCash,
    calculateAvailableCashForMonth,
    getMonthBreakdown,
    evaluateItemAffordability,
    toggleSimulatorAccount,
    selectSimulatorCreditCard,
    userSettings,
    updateUserSettings,
    loading,
  };
}