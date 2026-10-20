import AsyncStorage from '@react-native-async-storage/async-storage';
import { commitGoalChange, recoverGoalWrite } from '../lib/goalStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const goals = [{ id: 'g1', name: 'Reserva', targetAmount: 1000, monthlyContribution: 100, savedAmount: 0, color: '#000', icon: 'flag' }];
const transactions = [{ id: 't1', description: 'Aporte', amount: 100, type: 'receita' as const, date: '2026-10-20', accountId: 'bank', recurrence: 'unica' as const, paid: true, goalIds: ['g1'] }];

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

it('desfaz exclusão de meta se a gravação dos vínculos falhar', async () => {
  await AsyncStorage.multiSet([
    ['@horizonte:goals', JSON.stringify(goals)],
    ['@horizonte:transactions', JSON.stringify(transactions)],
  ]);
  const realMultiSet = jest.mocked(AsyncStorage.multiSet).getMockImplementation()!;
  jest.mocked(AsyncStorage.multiSet)
    .mockImplementationOnce(realMultiSet)
    .mockImplementationOnce(async pairs => {
      await realMultiSet(pairs.slice(0, 1));
      throw new Error('Sem espaço');
    });

  await expect(commitGoalChange([], [{ ...transactions[0], goalIds: undefined }])).rejects.toThrow('Sem espaço');
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:goals'))!)).toEqual(goals);
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:transactions'))!)).toEqual(transactions);
  expect(await AsyncStorage.getItem('@horizonte:goal_journal')).toBeNull();
});

it('recupera os dados anteriores de uma alteração interrompida', async () => {
  await AsyncStorage.multiSet([
    ['@horizonte:goals', '[]'],
    ['@horizonte:transactions', JSON.stringify([{ ...transactions[0], goalIds: undefined }])],
    ['@horizonte:goal_journal', JSON.stringify([
      ['@horizonte:goals', JSON.stringify(goals)],
      ['@horizonte:transactions', JSON.stringify(transactions)],
    ])],
  ]);

  await recoverGoalWrite();
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:goals'))!)).toEqual(goals);
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:transactions'))!)).toEqual(transactions);
  expect(await AsyncStorage.getItem('@horizonte:goal_journal')).toBeNull();
});
