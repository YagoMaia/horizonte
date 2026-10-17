import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../hooks/useStore';
import { Account, Transaction } from '../constants/types';
import { buildBackup, parseBackup } from '../lib/backup';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../services/notificationService', () => ({
  scheduleDailyReminder: jest.fn(), scheduleExpenseReminder: jest.fn(),
  scheduleCreditCardAlert: jest.fn(), cancelDailyReminder: jest.fn(),
  cancelExpenseReminder: jest.fn(), cancelCreditCardAlert: jest.fn(),
}));

const account: Account = { id: 'bank', name: 'Banco', type: 'corrente', balance: 0, color: '#000', icon: 'wallet' };
const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx', description: 'Lançamento', amount: 100, type: 'receita',
  date: '2020-01-15T12:00:00.000Z', accountId: account.id,
  recurrence: 'unica', paid: true, ...overrides,
});
async function seed(transactions: Transaction[], accounts = [account]) {
  await AsyncStorage.multiSet([
    ['@horizonte:accounts', JSON.stringify(accounts)],
    ['@horizonte:transactions', JSON.stringify(transactions)],
  ]);
}
async function openStore() {
  const hook = renderHook(() => useStore());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it('atualiza dados e preferências em memória após restaurar, sem reiniciar o app', async () => {
  const { result } = await openStore();
  const snapshot = parseBackup({ accounts: [{ ...account, balance: 100 }], transactions: [tx({})] }).data;
  snapshot.projects = [{ id: 'project', name: 'Viagem', color: '#000', targetBudget: 1000 }];
  snapshot.goals = [{ id: 'goal', name: 'Reserva', color: '#000', icon: 'flag', savedAmount: 10, monthlyContribution: 100, targetAmount: 1000 }];
  snapshot.userSettings = { dailyAllowance: 50, safetyMargin: 200 };
  snapshot.notificationPreferences.dailyReminders = false;
  await act(async () => { await result.current.restoreBackup(buildBackup(snapshot)); });
  expect(result.current.transactions).toEqual(snapshot.transactions);
  expect(result.current.totalBalance).toBe(100);
  expect(result.current.projects).toEqual(snapshot.projects);
  expect(result.current.goals).toEqual(snapshot.goals);
  expect(result.current.userSettings).toEqual(snapshot.userSettings);
  expect(result.current.notificationPreferences.dailyReminders).toBe(false);
});

it('contabiliza nas metas apenas aportes realizados e divide centavos sem duplicar valores', async () => {
  await AsyncStorage.setItem('@horizonte:goals', JSON.stringify([
    { id: 'a', savedAmount: 10 }, { id: 'b', savedAmount: 0 },
  ]));
  await seed([
    tx({ id: 'shared', amount: 100.01, goalIds: ['a', 'b'] }),
    tx({ id: 'pending', amount: 500, paid: false, goalIds: ['a'] }),
    tx({ id: 'future', amount: 700, date: '2099-01-01T12:00:00Z', goalIds: ['a'] }),
    tx({ id: 'single', amount: 20, type: 'transferencia', targetAccountId: 'savings', goalIds: ['b'] }),
  ], [account, { ...account, id: 'savings' }]);
  const { result } = await openStore();
  expect(result.current.getGoalSavedAmount('a')).toBe(60.01);
  expect(result.current.getGoalSavedAmount('b')).toBe(70);
  expect(result.current.getGoalSavedAmount('missing')).toBe(0);
});

it('remove vínculos explicitamente e preserva os que não foram enviados na edição', async () => {
  await seed([tx({ projectId: 'project', goalIds: ['goal'] })]);
  const { result, unmount } = await openStore();
  await act(async () => { await result.current.updateTransaction(tx({ description: 'Renomeado' })); });
  expect(result.current.transactions[0]).toMatchObject({ projectId: 'project', goalIds: ['goal'] });
  await act(async () => {
    await result.current.updateTransaction({ ...result.current.transactions[0], projectId: undefined, goalIds: [] });
  });
  expect(result.current.transactions[0].projectId).toBeUndefined();
  expect(result.current.transactions[0].goalIds).toEqual([]);
  unmount();
  const reopened = await openStore();
  expect(reopened.result.current.transactions[0].projectId).toBeUndefined();
  expect(reopened.result.current.transactions[0].goalIds).toEqual([]);
});

it('salva a nova data na edição individual e preserva metadados da recorrência', async () => {
  const original = tx({ id: 'series-0', groupId: 'series', groupIndex: 0 });
  await seed([original]);
  const { result, unmount } = await openStore();
  await act(async () => {
    await result.current.updateTransaction({ ...original, date: '2099-02-10T12:00:00.000Z' }, 'single');
  });
  expect(result.current.transactions[0]).toMatchObject({ date: '2099-02-10T12:00:00.000Z', groupId: 'series', groupIndex: 0 });
  expect(result.current.totalBalance).toBe(0);
  unmount();
  const reopened = await openStore();
  expect(reopened.result.current.transactions[0].date).toBe('2099-02-10T12:00:00.000Z');
  expect(reopened.result.current.totalBalance).toBe(0);
});

it('recalcula e persiste o saldo imediatamente após limpar ajustes', async () => {
  await seed([tx({ id: 'initial', amount: 1000, isAdjustment: true }), tx({ id: 'income', amount: 100 })]);
  const { result, unmount } = await openStore();
  expect(result.current.totalBalance).toBe(1100);
  await act(async () => { await result.current.purgeAdjustments(); });
  expect(result.current.totalBalance).toBe(100);
  expect(result.current.transactions.map(t => t.id)).toEqual(['income']);
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:accounts'))!)[0].balance).toBe(100);
  unmount();
  expect((await openStore()).result.current.totalBalance).toBe(100);
});

it('mantém receitas e despesas vencidas pendentes ao reabrir e recalcula apenas valores realizados', async () => {
  const entries = [tx({ id: 'paid', amount: 200 }),
    tx({ id: 'income', amount: 1000, paid: false }),
    tx({ id: 'expense', type: 'despesa', amount: 300, paid: false })];
  await seed(entries);
  const { result, unmount } = await openStore();
  expect(result.current.transactions).toEqual(entries);
  expect(result.current.totalBalance).toBe(200);
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:transactions'))!)).toEqual(entries);
  unmount();
  const reopened = await openStore();
  expect(reopened.result.current.totalBalance).toBe(200);
  expect(reopened.result.current.transactions.filter(t => !t.paid)).toHaveLength(2);
});
