import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../hooks/useStore';
import { Account } from '../constants/types';
import * as NotificationService from '../services/notificationService';

// Mock do AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock do NotificationService (já que é usado no useStore)
jest.mock('../services/notificationService', () => ({
  scheduleDailyReminder: jest.fn(), scheduleExpenseReminder: jest.fn(),
  scheduleCreditCardAlert: jest.fn(), cancelDailyReminder: jest.fn(),
  cancelExpenseReminder: jest.fn(), cancelCreditCardAlert: jest.fn(),
  hasNotificationPermission: jest.fn(async () => false),
}));

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

describe('useStore hook', () => {
  it('começa com lembretes desligados até a pessoa ativá-los', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notificationPreferences).toEqual(expect.objectContaining({
      dailyReminders: false,
      expenseReminders: false,
      creditCardAlerts: false,
    }));
  });

  it('cancela todos os lembretes antes de apagar os dados', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.clearAllData(); });

    expect(NotificationService.cancelDailyReminder).toHaveBeenCalled();
    expect(NotificationService.cancelExpenseReminder).toHaveBeenCalled();
    expect(NotificationService.cancelCreditCardAlert).toHaveBeenCalled();
  });

  it('protege lançamentos vinculados ao excluir ou trocar o tipo de uma conta', async () => {
    const accounts = [
      { id: 'bank', name: 'Banco', type: 'corrente' as const, balance: 0, color: '#000', icon: 'wallet' },
      { id: 'cash', name: 'Carteira', type: 'carteira' as const, balance: 0, color: '#111', icon: 'cash' },
    ];
    const transactions = [{
      id: 'tx', description: 'Mercado', amount: 100, type: 'despesa' as const,
      date: '2026-10-20T12:00:00.000Z', accountId: 'bank', paid: true, recurrence: 'unica' as const,
    }];
    await AsyncStorage.multiSet([
      ['@horizonte:accounts', JSON.stringify(accounts)],
      ['@horizonte:transactions', JSON.stringify(transactions)],
    ]);

    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.deleteAccount('bank')).rejects.toThrow('possui lançamentos');
      await expect(result.current.updateAccount({ ...result.current.accounts.find(a => a.id === 'bank')!, type: 'cartao_credito' })).rejects.toThrow('alterar o tipo');
    });

    expect(result.current.accounts).toHaveLength(2);
    expect(result.current.transactions).toHaveLength(1);
  });

  it('Cenário 1: Calculates total balance correctly after adding income and expense', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const account: Account = {
      id: 'acc1',
      name: 'Conta Corrente',
      type: 'corrente',
      balance: 0,
      color: '#000',
      icon: 'wallet',
    };

    await act(async () => {
      // Mock para carregar os dados vazio
      await result.current.clearAllData();
      await result.current.addAccount(account);
    });

    await act(async () => {
      // Adiciona Receita de 1000
      await result.current.addTransaction({
        description: 'Salário',
        amount: 1000,
        type: 'receita',
        date: new Date().toISOString(),
        accountId: 'acc1',
        recurrence: 'unica',
        paid: true,
      });
    });

    await act(async () => {
      // Adiciona Despesa de 300
      await result.current.addTransaction({
        description: 'Conta de Luz',
        amount: 300,
        type: 'despesa',
        date: new Date().toISOString(),
        accountId: 'acc1',
        recurrence: 'unica',
        paid: true,
      });
    });

    // 1000 - 300 = 700
    expect(result.current.totalBalance).toBe(700);
    expect(result.current.accounts[0].balance).toBe(700);
  });

  it('Cenário 2: Updates project spent amount correctly', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const project = {
      name: 'Viagem',
      targetBudget: 5000,
      color: '#FFF',
      active: true,
    };

    await act(async () => {
      await result.current.clearAllData();
      await result.current.addProject(project);
    });

    const addedProject = result.current.projects[0];
    expect(addedProject).toBeDefined();

    await act(async () => {
      await result.current.addTransaction({
        description: 'Passagem Aérea',
        amount: 1500,
        type: 'despesa',
        date: new Date().toISOString(),
        accountId: 'acc_dummy', // Não importa a conta pro projeto
        recurrence: 'unica',
        paid: true,
        projectId: addedProject.id,
      });
    });

    // O projeto agora precisa ser processado com a transação
    // O useStore processa isso na tela via useMemo, mas podemos verificar se a transação
    // foi salva com o projectId e tentar calcular localmente ou verificar se os dados estão consistentes
    const projectTx = result.current.transactions.find(tx => tx.projectId === addedProject.id);
    expect(projectTx).toBeDefined();
    expect(projectTx?.amount).toBe(1500);

    // Verifica a nova função centralizada
    const spent = result.current.getProjectSpent(addedProject.id);
    expect(spent).toBe(1500);
  });

  it('mantém todos os projetos quando são criados em sequência', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await Promise.all([
        result.current.addProject({ name: 'Reforma', targetBudget: 1000, color: '#000', active: true }),
        result.current.addProject({ name: 'Viagem', targetBudget: 2000, color: '#111', active: true }),
      ]);
    });

    expect(result.current.projects.map(project => project.name)).toEqual(['Reforma', 'Viagem']);
    expect(new Set(result.current.projects.map(project => project.id)).size).toBe(2);
  });

  it('desvincula lançamentos ao excluir projeto sem apagar o histórico', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addProject({ name: 'Reforma', targetBudget: 1000, color: '#000', active: true });
    });
    const project = result.current.projects[0];
    await act(async () => {
      await result.current.addTransaction({ description: 'Material', amount: 200, type: 'despesa', date: new Date().toISOString(), accountId: 'conta', recurrence: 'unica', paid: true, projectId: project.id });
      await result.current.deleteProject(project.id);
    });

    expect(result.current.projects).toEqual([]);
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].projectId).toBeUndefined();
  });

  it('mantém metas criadas em sequência e desvincula a meta excluída dos lançamentos', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await Promise.all([
        result.current.addGoal({ name: 'Reserva', targetAmount: 1000, monthlyContribution: 100, savedAmount: 0, color: '#000', icon: 'flag' }),
        result.current.addGoal({ name: 'Viagem', targetAmount: 2000, monthlyContribution: 200, savedAmount: 0, color: '#111', icon: 'flag' }),
      ]);
    });
    expect(result.current.goals.map(goal => goal.name)).toEqual(['Reserva', 'Viagem']);
    const goal = result.current.goals[0];

    await act(async () => {
      await result.current.addTransaction({ description: 'Aporte', amount: 100, type: 'receita', date: new Date().toISOString(), accountId: 'conta', recurrence: 'unica', paid: true, goalIds: [goal.id] });
      await result.current.deleteGoal(goal.id);
    });
    expect(result.current.goals).toHaveLength(1);
    expect(result.current.transactions[0].goalIds).toBeUndefined();
  });

  it('mantém categorias criadas em sequência', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const initialCount = result.current.tags.length;

    await act(async () => {
      await Promise.all([
        result.current.addTag({ label: 'Assinaturas', icon: 'card', color: '#000' }),
        result.current.addTag({ label: 'Freelance', icon: 'briefcase', color: '#111' }),
      ]);
    });
    expect(result.current.tags).toHaveLength(initialCount + 2);
    expect(result.current.tags.slice(-2).map(tag => tag.label)).toEqual(['Assinaturas', 'Freelance']);
  });

  it('Cenário 3: getProjectSpent should include both "despesa" and "transferencia"', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.clearAllData();
      await result.current.addProject({
        name: 'Projeto Teste',
        targetBudget: 1000,
        color: '#F00',
        active: true,
      });
    });

    const project = result.current.projects[0];

    await act(async () => {
      // Adiciona Despesa
      await result.current.addTransaction({
        description: 'Despesa',
        amount: 200,
        type: 'despesa',
        date: new Date().toISOString(),
        accountId: 'acc1',
        paid: true,
        projectId: project.id,
        recurrence: 'unica',
      });
    });

    await act(async () => {
      // Adiciona Transferência (saída de valor para o projeto)
      await result.current.addTransaction({
        description: 'Transferência para Projeto',
        amount: 300,
        type: 'transferencia',
        date: new Date().toISOString(),
        accountId: 'acc1',
        targetAccountId: 'acc2',
        paid: true,
        projectId: project.id,
        recurrence: 'unica',
      });
    });

    await act(async () => {
      // Receitas são exibidas separadamente e entram no saldo disponível do projeto.
      await result.current.addTransaction({
        description: 'Reembolso',
        amount: 50,
        type: 'receita',
        date: new Date().toISOString(),
        accountId: 'acc1',
        paid: true,
        projectId: project.id,
        recurrence: 'unica',
      });
    });

    // Gasto bruto: 200 + 300. Disponível: 50 - 500.
    const totalSpent = result.current.getProjectSpent(project.id);
    expect(totalSpent).toBe(500);
    expect(result.current.getProjectStats(project.id)).toEqual({ income: 50, spent: 500, available: -450 });
  });
});
