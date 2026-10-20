import AsyncStorage from '@react-native-async-storage/async-storage';
import { commitProjectChange, recoverProjectWrite } from '../lib/projectStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const projects = [{ id: 'p1', name: 'Viagem', targetBudget: 1000, color: '#000', active: true }];
const transactions = [{ id: 't1', description: 'Passagem', amount: 300, type: 'despesa' as const, date: '2026-10-20', accountId: 'bank', recurrence: 'unica' as const, paid: true, projectId: 'p1' }];

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

it('desfaz a alteração quando a desvinculação de projeto falha no armazenamento', async () => {
  await AsyncStorage.multiSet([
    ['@horizonte:projects', JSON.stringify(projects)],
    ['@horizonte:transactions', JSON.stringify(transactions)],
  ]);
  const realMultiSet = jest.mocked(AsyncStorage.multiSet).getMockImplementation()!;
  jest.mocked(AsyncStorage.multiSet)
    .mockImplementationOnce(realMultiSet)
    .mockImplementationOnce(async pairs => {
      await realMultiSet(pairs.slice(0, 1));
      throw new Error('Sem espaço');
    });

  await expect(commitProjectChange([], [{ ...transactions[0], projectId: undefined }])).rejects.toThrow('Sem espaço');
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:projects'))!)).toEqual(projects);
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:transactions'))!)).toEqual(transactions);
  expect(await AsyncStorage.getItem('@horizonte:project_journal')).toBeNull();
});

it('recupera a última versão após uma interrupção antes da tela abrir', async () => {
  await AsyncStorage.multiSet([
    ['@horizonte:projects', '[]'],
    ['@horizonte:transactions', JSON.stringify([{ ...transactions[0], projectId: undefined }])],
    ['@horizonte:project_journal', JSON.stringify([
      ['@horizonte:projects', JSON.stringify(projects)],
      ['@horizonte:transactions', JSON.stringify(transactions)],
    ])],
  ]);

  await recoverProjectWrite();
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:projects'))!)).toEqual(projects);
  expect(JSON.parse((await AsyncStorage.getItem('@horizonte:transactions'))!)).toEqual(transactions);
  expect(await AsyncStorage.getItem('@horizonte:project_journal')).toBeNull();
});
