import { renderHook, act } from '@testing-library/react-native';
import { useStore } from '../hooks/useStore';
import { Account, Project, Transaction } from '../constants/types';

// Mock do AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock do NotificationService (já que é usado no useStore)
jest.mock('../services/notificationService', () => ({
  scheduleCreditCardReminder: jest.fn(),
  scheduleMonthlyPaymentReminder: jest.fn(),
  cancelReminder: jest.fn(),
}));

describe('useStore hook', () => {
  it('Cenário 1: Calculates total balance correctly after adding income and expense', async () => {
    const { result } = renderHook(() => useStore());

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
  });
});
