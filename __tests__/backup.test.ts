import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildBackup, createBackup, parseBackup, restoreBackup, recoverPendingRestore } from '../lib/backup';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

const data = {
  accounts: [{ id: 'bank', name: 'Banco', type: 'corrente', balance: 200, color: '#000', icon: 'wallet' }],
  transactions: [{ id: 't1', description: 'Aporte', amount: 200, type: 'receita', date: '2020-01-01T12:00:00Z', accountId: 'bank', recurrence: 'unica', paid: true, projectId: 'p1', goalIds: ['g1'] }],
  tags: [], monthlyBudgets: { '2026-10': 500 }, showPending: false, hasSeenOnboarding: true,
  projects: [{ id: 'p1', name: 'Viagem', targetBudget: 5000, color: '#000' }],
  goals: [{ id: 'g1', name: 'Reserva', targetAmount: 1000, monthlyContribution: 100, savedAmount: 0, color: '#000', icon: 'flag' }],
  notificationPreferences: { dailyReminders: false, dailyReminderTime: { hour: 20, minute: 0 }, expenseReminders: false, expenseReminderTime: { hour: 9, minute: 0 }, creditCardAlerts: false, creditCardAlertTime: { hour: 8, minute: 0 } },
  homeLayout: [{ id: 'balance', visible: true }], totaisLayout: [{ id: 'stats', visible: false }],
  userSettings: { dailyAllowance: 100, safetyMargin: 200 }, themeMode: 'dark', primaryColor: '#FF7043',
};

it('exporta todos os dados e configurações necessários para recuperar a instalação', () => {
  expect(buildBackup(data).data).toEqual(data);
});

it('preserva orçamentos de janeiro e dezembro usando os índices de mês do aplicativo', async () => {
  const snapshot = { ...data, monthlyBudgets: { '2026-00': 100, '2026-11': 200 } };
  await restoreBackup(buildBackup(snapshot));
  expect((await createBackup()).data.monthlyBudgets).toEqual(snapshot.monthlyBudgets);
});

it('recupera um backup completo em armazenamento vazio e mantém o mesmo conteúdo ao exportar', async () => {
  await restoreBackup(buildBackup(data));
  expect((await createBackup()).data).toEqual(data);
  expect(await AsyncStorage.getItem('@horizonte:theme_mode')).toBe('dark');
  expect(await AsyncStorage.getItem('@horizonte:restore_journal')).toBeNull();
});

it.each([
  ['contas inválidas', { accounts: {} }],
  ['data impossível', { transactions: [{ ...data.transactions[0], date: '2026-02-30' }] }],
  ['valor inválido', { transactions: [{ ...data.transactions[0], amount: '200' }] }],
  ['conta inexistente', { transactions: [{ ...data.transactions[0], accountId: 'missing' }] }],
  ['projeto inexistente', { projects: [] }],
  ['meta inexistente', { goals: [] }],
  ['horário inválido', { notificationPreferences: { ...data.notificationPreferences, dailyReminderTime: { hour: 25, minute: 0 } } }],
])('rejeita %s sem alterar os dados atuais', async (_, changes) => {
  await restoreBackup(buildBackup(data));
  await expect(restoreBackup({ version: '2.0', data: { ...data, ...changes } })).rejects.toThrow('Backup inválido');
  expect((await createBackup()).data).toEqual(data);
});

it('migra backup antigo sem misturar metas e projetos da instalação anterior', async () => {
  await restoreBackup(buildBackup(data));
  const legacy = { accounts: data.accounts, transactions: data.transactions };
  const parsed = parseBackup(legacy);
  expect(parsed.legacy).toBe(true);
  await restoreBackup(legacy);
  const restored = (await createBackup()).data;
  expect(restored.projects).toEqual([]);
  expect(restored.goals).toEqual([]);
  expect(restored.transactions[0].projectId).toBeUndefined();
  expect(restored.transactions[0].goalIds).toEqual([]);
  expect(restored.themeMode).toBe('system');
});

it('desfaz gravação parcial se o armazenamento falhar durante a restauração', async () => {
  await restoreBackup(buildBackup(data));
  const realMultiSet = jest.mocked(AsyncStorage.multiSet).getMockImplementation()!;
  // A primeira escrita grava o diário; a segunda simula falha depois de escrever uma chave.
  jest.mocked(AsyncStorage.multiSet)
    .mockImplementationOnce(realMultiSet)
    .mockImplementationOnce(async pairs => {
      await realMultiSet(pairs.slice(0, 1));
      throw new Error('Sem espaço');
    });
  await expect(restoreBackup(buildBackup({ ...data, accounts: [{ ...data.accounts[0], name: 'Outro banco' }] }))).rejects.toThrow('Sem espaço');
  expect((await createBackup()).data).toEqual(data);
  expect(await AsyncStorage.getItem('@horizonte:restore_journal')).toBeNull();
});

it('recupera o estado anterior após uma interrupção e uma tentativa de rollback que também falhou', async () => {
  await restoreBackup(buildBackup(data));
  const realMultiSet = jest.mocked(AsyncStorage.multiSet).getMockImplementation()!;
  jest.mocked(AsyncStorage.multiSet)
    .mockImplementationOnce(realMultiSet)
    .mockImplementationOnce(async pairs => {
      await realMultiSet(pairs.slice(0, 1));
      throw new Error('Interrompido');
    })
    .mockRejectedValueOnce(new Error('Armazenamento indisponível'));
  await expect(restoreBackup(buildBackup({ ...data, accounts: [{ ...data.accounts[0], name: 'Parcial' }] }))).rejects.toThrow();
  expect(await AsyncStorage.getItem('@horizonte:restore_journal')).not.toBeNull();
  await recoverPendingRestore();
  expect((await createBackup()).data).toEqual(data);
});
