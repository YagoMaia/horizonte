import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PurchaseImportProvider, usePurchaseImportContext } from '../context/PurchaseImportContext';
import { IMPORT_KEY, PurchaseBank } from '../lib/purchaseImport';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockNative = { hasAccess: jest.fn(async () => true), dropped: jest.fn(async () => 0), read: jest.fn(), acknowledge: jest.fn(async () => {}), configure: jest.fn(async () => {}), clear: jest.fn(async () => {}) };
let mockStore: any;
jest.mock('../services/purchaseCapture', () => ({ captureNative: () => mockNative }));
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
const bank: PurchaseBank = { packageName: 'bank', name: 'Banco', enabled: true, credito: { mode: 'auto', accountId: 'card' }, debito: { mode: 'review', accountId: 'cash' } };
const event = (id: string, kind = 'crédito') => ({ id, packageName: 'bank', title: 'Banco', text: `Compra aprovada no ${kind} de R$ 45,90`, timestamp: new Date(2026, 0, 1).getTime() });
const wrapper = ({ children }: { children: React.ReactNode }) => <PurchaseImportProvider>{children}</PurchaseImportProvider>;
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear();
  await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify({ banks: [bank], pending: [], handled: [] }));
  mockStore = { loading: false, accounts: [{ id: 'card', type: 'cartao_credito' }, { id: 'cash', type: 'corrente' }], addTransaction: jest.fn(async () => {}) };
  mockNative.read.mockResolvedValue(JSON.stringify([event('credit'), event('debit', 'débito')]));
});
it('automatiza crédito, deixa débito para revisão e confirma uma única vez', async () => {
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(result.current.state.pending).toHaveLength(1));
  expect(mockStore.addTransaction).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'card', paid: false, paymentMethod: 'credito', notificationImportId: 'credit' }));
  await act(async () => { await result.current.scan(); });
  expect(mockStore.addTransaction).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.review(result.current.state.pending[0], 'debito', 'cash', 45.9, 'Mercado'); });
  expect(mockStore.addTransaction).toHaveBeenLastCalledWith(expect.objectContaining({ paid: true, paymentMethod: 'debito' }));
  expect(result.current.state.pending).toHaveLength(0);
  unmount();
});
it('conta ausente impede automação e modalidade desativada é ignorada', async () => {
  await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify({ banks: [{ ...bank, credito: { mode: 'auto', accountId: 'missing' }, debito: { mode: 'off', accountId: 'cash' } }], pending: [], handled: [] }));
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(result.current.state.pending).toHaveLength(1));
  expect(mockStore.addTransaction).not.toHaveBeenCalled();
  await act(async () => { await result.current.dismiss('credit'); });
  expect(result.current.state.pending).toHaveLength(0);
  unmount();
});
