import React from 'react';
import { Alert, Platform, Switch } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { MenuScreen } from '../components/screens/MenuScreen';

let mockStore: any;
const mockTheme: any = { colors: require('../constants/theme').Colors.light, themeMode: 'system', primaryColor: '#007AFF', setThemeMode: jest.fn(), setPrimaryColor: jest.fn(), reloadTheme: jest.fn() };
const mockPicker = { getDocumentAsync: jest.fn() };
const mockFileSystem = { documentDirectory: 'file://documents/', writeAsStringAsync: jest.fn() };
const mockSharing = { isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn() };
const mockPermissions = jest.fn(async () => true);
const mockBackup = { createBackup: jest.fn(async () => ({ version: '2.0', data: {} })), parseBackup: jest.fn((value) => ({ data: { transactions: value?.data?.transactions || [] }, legacy: false })) };

jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => mockTheme }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: any) => require('react').createElement(require('react-native').Text, null, name) }));
jest.mock('expo-file-system', () => mockFileSystem);
jest.mock('expo-sharing', () => mockSharing);
jest.mock('expo-document-picker', () => mockPicker);
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'notification'),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('@/services/notificationService', () => ({
  DEFAULT_NOTIFICATION_CHANNEL_ID: 'default',
  requestPermissions: () => mockPermissions(),
}));
jest.mock('@/lib/backup', () => mockBackup);
jest.mock('../components/TagManagementModal', () => ({ TagManagementModal: ({ visible }: any) => visible ? require('react').createElement(require('react-native').Text, null, 'Categorias abertas') : null }));
jest.mock('../components/AdjustmentManagementModal', () => ({ AdjustmentManagementModal: ({ visible }: any) => visible ? require('react').createElement(require('react-native').Text, null, 'Ajustes abertos') : null }));
const mockNotifications = jest.requireMock('expo-notifications');

const navigation = { accounts: jest.fn(), projects: jest.fn(), goals: jest.fn(), home: jest.fn(), totals: jest.fn() };
const transaction = { id: 't', description: 'Mercado', amount: 25, accountId: 'bank', type: 'despesa', date: '2026-10-18', paid: true, recurrence: 'unica' };

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions.mockResolvedValue(true);
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  mockPicker.getDocumentAsync.mockResolvedValue({ canceled: true });
  mockStore = { accounts: [{ id: 'bank', name: 'Conta', balance: 0, type: 'corrente', color: '#000', icon: 'wallet' }], transactions: [transaction], restoreBackup: jest.fn(), clearAllData: jest.fn(), syncBalances: jest.fn(), purgeAdjustments: jest.fn(), notificationPreferences: { dailyReminders: true, dailyReminderTime: { hour: 9, minute: 0 }, expenseReminders: true, expenseReminderTime: { hour: 20, minute: 0 }, creditCardAlerts: true, creditCardAlertTime: { hour: 8, minute: 0 } }, toggleNotificationPreference: jest.fn(), updateNotificationTime: jest.fn() };
});

function screen() { return render(<MenuScreen onNavigateToAccounts={navigation.accounts} onNavigateToProjects={navigation.projects} onNavigateToMetas={navigation.goals} onNavigateToHomeLayout={navigation.home} onNavigateToTotaisLayout={navigation.totals} />); }
function confirmedAction(spy: jest.SpyInstance, title: string) { const call = spy.mock.calls.find(([value]) => value === title); return call?.[2]?.find((item: any) => typeof item.onPress === 'function')?.onPress; }

it('aciona todas as navegações, modais de gerenciamento e aparência', () => {
  const ui = screen();
  fireEvent.press(ui.getByText('Gerenciar Contas')); fireEvent.press(ui.getByText('Gerenciar Projetos')); fireEvent.press(ui.getByText('Gerenciar Metas')); fireEvent.press(ui.getByText('Personalizar Tela Inicial')); fireEvent.press(ui.getByText('Personalizar Tela de Totais'));
  expect(navigation).toEqual(expect.objectContaining({ accounts: expect.any(Function), projects: expect.any(Function), goals: expect.any(Function), home: expect.any(Function), totals: expect.any(Function) }));
  expect(navigation.accounts).toHaveBeenCalled(); expect(navigation.projects).toHaveBeenCalled(); expect(navigation.goals).toHaveBeenCalled(); expect(navigation.home).toHaveBeenCalled(); expect(navigation.totals).toHaveBeenCalled();
  fireEvent.press(ui.getByText('Gerenciar Categorias')); expect(ui.getByText('Categorias abertas')).toBeTruthy();
  fireEvent.press(ui.getByText('Ajustes de Saldo')); expect(ui.getByText('Ajustes abertos')).toBeTruthy();
  fireEvent.press(ui.getByText('Tema')); fireEvent.press(ui.getByText('Ativado (Escuro)')); expect(mockTheme.setThemeMode).toHaveBeenCalledWith('dark');
  fireEvent.press(ui.getByText('Cor principal')); expect(ui.getByText('Cor Principal')).toBeTruthy();
});

it('aciona os três horários, interruptores e notificação de teste', async () => {
  const ui = screen();
  for (const pencil of ui.getAllByText('pencil')) { fireEvent.press(pencil); await act(async () => { fireEvent.press(ui.getByText('Salvar')); }); }
  expect(mockStore.updateNotificationTime).toHaveBeenCalledTimes(3);
  const switches = ui.UNSAFE_getAllByType(Switch);
  for (const control of switches) await act(async () => { fireEvent(control, 'valueChange', false); });
  expect(mockPermissions).not.toHaveBeenCalled();
  expect(mockStore.toggleNotificationPreference).toHaveBeenCalledWith('dailyReminders', false);
  expect(mockStore.toggleNotificationPreference).toHaveBeenCalledWith('expenseReminders', false);
  expect(mockStore.toggleNotificationPreference).toHaveBeenCalledWith('creditCardAlerts', false);
  await act(async () => { fireEvent(switches[0], 'valueChange', true); });
  expect(mockPermissions).toHaveBeenCalledTimes(1);
  expect(mockStore.toggleNotificationPreference).toHaveBeenCalledWith('dailyReminders', true);
  expect(ui.getByText('09:00')).toBeTruthy(); expect(ui.getByText('20:00')).toBeTruthy(); expect(ui.getByText('08:00')).toBeTruthy();
});

it('agenda o teste com gatilho de intervalo explícito', async () => {
  const ui = screen();

  await act(async () => { fireEvent.press(ui.getByLabelText('Enviar Notificação de Teste')); });

  expect(mockPermissions).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    trigger: { type: 'timeInterval', seconds: 5, channelId: 'default' },
  })));
});

it('despacha backup, restauração cancelada e exportação sem tocar em dados reais', async () => {
  const ui = screen();
  await act(async () => { fireEvent.press(ui.getByText('Criar Backup de Segurança')); });
  await act(async () => { fireEvent.press(ui.getByText('Restaurar Backup')); });
  await act(async () => { fireEvent.press(ui.getByText('Exportar para Excel (CSV)')); });
  expect(mockStore.restoreBackup).not.toHaveBeenCalled();
});

it('solicita confirmação antes de sincronizar, remover ajustes e apagar dados', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const ui = screen();
  fireEvent.press(ui.getByText('Sincronizar Saldos (Correção)'));
  act(() => confirmedAction(alert, 'Sincronizar Saldos')?.()); expect(mockStore.syncBalances).toHaveBeenCalledWith(mockStore.transactions, mockStore.accounts);
  fireEvent.press(ui.getByText('Limpar Ajustes de Saldo'));
  act(() => confirmedAction(alert, 'Limpar Ajustes de Saldo')?.()); expect(mockStore.purgeAdjustments).toHaveBeenCalled();
  fireEvent.press(ui.getByText('Limpar todos os dados'));
  act(() => confirmedAction(alert, 'Atenção Crítica')?.()); expect(mockStore.clearAllData).toHaveBeenCalled();
  alert.mockRestore();
});
