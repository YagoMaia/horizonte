import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoreProvider, useStoreContext } from '../context/StoreContext';
import { PurchaseImportProvider, usePurchaseImportContext } from '../context/PurchaseImportContext';
import { IMPORT_KEY } from '../lib/purchaseImport';
import { IMPORT_RESET_KEY, isPurchaseImportPaused } from '../lib/purchaseImportLifecycle';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../services/notificationService', () => ({
  scheduleDailyReminder: jest.fn(), scheduleExpenseReminder: jest.fn(), scheduleCreditCardAlert: jest.fn(),
  cancelDailyReminder: jest.fn(), cancelExpenseReminder: jest.fn(), cancelCreditCardAlert: jest.fn(), hasNotificationPermission: jest.fn(async () => false),
}));
const mockNative = { hasAccess: jest.fn(async () => true), dropped: jest.fn(async () => 0), read: jest.fn(async () => '[]'), acknowledge: jest.fn(async (_ids: string[]) => {}), configure: jest.fn(async (_packages: string[]) => {}), clear: jest.fn(async () => {}) };
jest.mock('../services/purchaseCapture', () => ({ captureNative: () => mockNative }));
const wrapper = ({ children }: { children: React.ReactNode }) => <StoreProvider><PurchaseImportProvider>{children}</PurchaseImportProvider></StoreProvider>;
const bank = { packageName: 'bank', name: 'Banco', enabled: true, credito: { mode: 'off', accountId: '' }, debito: { mode: 'auto', accountId: 'cash', allowWithoutIdentifier: true } };
beforeEach(async () => {
  jest.clearAllMocks(); mockNative.read.mockResolvedValue('[]'); await AsyncStorage.clear();
  await AsyncStorage.multiSet([
    ['@horizonte:accounts', JSON.stringify([{ id: 'cash', type: 'corrente', name: 'Conta', balance: 0, color: '#000', icon: 'wallet' }])],
    [IMPORT_KEY, JSON.stringify({ banks: [bank], pending: [], handled: [] })],
  ]);
});

it('apagar dados aguarda importação em andamento e não permite que ela reapareça', async () => {
  const hook = renderHook(() => ({ store: useStoreContext(), importer: usePurchaseImportContext() }), { wrapper });
  await waitFor(() => expect(hook.result.current.importer.ready && !hook.result.current.store.loading).toBe(true));
  await act(async () => { await hook.result.current.importer.scan(); });
  let release!: () => void, entered = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const realWrite = jest.mocked(AsyncStorage.multiSet).getMockImplementation()!;
  jest.mocked(AsyncStorage.multiSet).mockImplementationOnce(async (pairs, ...rest) => {
    entered = true; await gate; return realWrite(pairs, ...rest);
  });
  mockNative.read.mockResolvedValue(JSON.stringify([{ id: 'during-reset', packageName: 'bank', title: 'Banco', text: 'Compra aprovada no débito R$ 45,90', timestamp: Date.now() }]));
  let scan!: Promise<void>;
  act(() => { scan = hook.result.current.importer.scan(); });
  await waitFor(() => expect(entered).toBe(true));
  let clear!: Promise<unknown>, finished = false;
  act(() => { clear = hook.result.current.store.clearAllData().then(() => { finished = true; }); });
  await waitFor(() => expect(isPurchaseImportPaused()).toBe(true));
  expect(finished).toBe(false);
  await act(async () => { release(); await scan; await clear; });
  expect(hook.result.current.store.transactions).toEqual([]);
  expect(hook.result.current.store.accounts).toEqual([]);
  expect(hook.result.current.importer.state.pending).toEqual([]);
  expect(hook.result.current.importer.state.banks).toEqual([]);
  expect(mockNative.clear).toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@horizonte:transactions')).toBeNull();
  expect(await AsyncStorage.getItem(IMPORT_RESET_KEY)).toBeNull();
  await act(async () => { await hook.result.current.importer.scan(); });
  expect(hook.result.current.store.transactions).toEqual([]); hook.unmount();
});

it('limpeza interrompida pausa a importação na próxima abertura e permite concluir a limpeza', async () => {
  await AsyncStorage.setItem(IMPORT_RESET_KEY, '1');
  const hook = renderHook(() => ({ store: useStoreContext(), importer: usePurchaseImportContext() }), { wrapper });
  await waitFor(() => expect(hook.result.current.importer.error).toContain('limpeza anterior'));
  expect(hook.result.current.importer.ready).toBe(false);
  expect(mockNative.read).not.toHaveBeenCalled();
  await act(async () => { await hook.result.current.store.clearAllData(); });
  expect(hook.result.current.importer.ready).toBe(true);
  expect(hook.result.current.importer.state.banks).toEqual([]); hook.unmount();
});

it('falha ao limpar captura impede apagar contas e pode ser repetida com segurança', async () => {
  const hook = renderHook(() => ({ store: useStoreContext(), importer: usePurchaseImportContext() }), { wrapper });
  await waitFor(() => expect(hook.result.current.importer.ready && !hook.result.current.store.loading).toBe(true));
  mockNative.clear.mockRejectedValueOnce(new Error('Não foi possível limpar captura'));
  await act(async () => { await expect(hook.result.current.store.clearAllData()).rejects.toThrow('captura'); });
  expect(hook.result.current.store.accounts).toHaveLength(1); expect(isPurchaseImportPaused()).toBe(true);
  await act(async () => { await hook.result.current.store.clearAllData(); });
  expect(isPurchaseImportPaused()).toBe(false); expect(hook.result.current.store.accounts).toEqual([]); hook.unmount();
});
