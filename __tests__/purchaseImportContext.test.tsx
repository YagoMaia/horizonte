import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PurchaseImportProvider, usePurchaseImportContext } from '../context/PurchaseImportContext';
import { IMPORT_KEY, PurchaseBank, PossiblePurchaseDuplicateError } from '../lib/purchaseImport';
import { loadPurchaseImport } from '../lib/purchaseImportStorage';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockNative = { hasAccess: jest.fn(async () => true), dropped: jest.fn(async () => 0), read: jest.fn(), acknowledge: jest.fn(async (_ids: string[]) => {}), configure: jest.fn(async (_packages: string[]) => {}), clear: jest.fn(async () => {}) };
let mockStore: any;
jest.mock('../services/purchaseCapture', () => ({ captureNative: () => mockNative }));
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
const bank: PurchaseBank = { packageName: 'bank', name: 'Banco', enabled: true, credito: { mode: 'auto', accountId: 'card', allowWithoutIdentifier: true }, debito: { mode: 'review', accountId: 'cash' } };
const event = (id: string, kind = 'crédito') => ({ id, packageName: 'bank', title: 'Banco', text: `Compra aprovada no ${kind} de R$ 45,90`, timestamp: Date.now() });
const wrapper = ({ children }: { children: React.ReactNode }) => <PurchaseImportProvider>{children}</PurchaseImportProvider>;
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear();
  mockNative.configure.mockReset().mockResolvedValue(undefined);
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

it('final desconhecido não usa o cartão padrão; permite vários cartões no mesmo aplicativo', async () => {
  await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify({ banks: [{ ...bank, credito: { ...bank.credito, destinations: [{ lastFour: '1234', accountId: 'card' }, { lastFour: '5678', accountId: 'card2' }] } }], pending: [], handled: [] }));
  mockStore.accounts.push({ id: 'card2', type: 'cartao_credito' });
  mockNative.read.mockResolvedValue(JSON.stringify(['1234', '5678', '9999'].map((final, index) => ({ ...event(String(index)), text: `Compra aprovada no crédito R$ 10,00 cartão final ${final}` }))));
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(result.current.state.pending).toHaveLength(1));
  expect(mockStore.addTransaction.mock.calls.map((call: any[]) => call[0].accountId)).toEqual(['card', 'card2']);
  expect(result.current.state.pending[0].lastFour).toBe('9999'); unmount();
});

it('possível duplicata precisa de confirmação explícita e parcelas têm total calculado', async () => {
  mockNative.read.mockResolvedValue(JSON.stringify([event('duplicate')]));
  mockStore.addTransaction.mockRejectedValueOnce(new PossiblePurchaseDuplicateError());
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(result.current.state.pending[0]?.possibleDuplicate).toBe(true));
  const candidate = result.current.state.pending[0];
  await act(async () => {
    await expect(result.current.review(candidate, 'credito', 'card', 45.9, 'Loja')).rejects.toThrow('parecido');
    await expect(result.current.review(candidate, 'credito', 'card', 45.9, 'Loja', { installments: 3, confirmDuplicate: true })).rejects.toThrow('total ou');
    await result.current.review(candidate, 'credito', 'card', 45.9, 'Loja', { installments: 3, amountBasis: 'installment', confirmDuplicate: true });
  });
  expect(mockStore.addTransaction).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 137.7, totalInstallments: 3, notificationImportOverride: true }));
  await act(async () => { await expect(result.current.review(candidate, 'credito', 'card', 45.9, 'Loja')).rejects.toThrow('já foi resolvida'); });
  unmount();
});

it('confirmação salva uma única vez após falha na gravação do índice e reenvio', async () => {
  mockNative.read.mockResolvedValue(JSON.stringify([event('retry', 'débito')]));
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(result.current.state.pending).toHaveLength(1));
  const candidate = result.current.state.pending[0];
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Disco cheio'));
  await act(async () => { await expect(result.current.review(candidate, 'debito', 'cash', 45.9, 'Loja')).rejects.toThrow('Disco cheio'); });
  expect(result.current.state.pending).toHaveLength(1);
  // Store-level idempotency is independently exercised in store-regressions.test.ts.
  await act(async () => { await result.current.review(candidate, 'debito', 'cash', 45.9, 'Loja'); });
  expect((await loadPurchaseImport()).pending).toHaveLength(0); unmount();
});

it('falha na aplicação nativa é reconciliada pela próxima atualização', async () => {
  mockNative.read.mockResolvedValue('[]');
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(mockNative.configure).toHaveBeenCalledWith(['bank']));
  mockNative.configure.mockRejectedValueOnce(new Error('Não foi possível pausar'));
  await act(async () => { await expect(result.current.saveBanks([{ ...bank, enabled: false }])).rejects.toThrow(); });
  expect(result.current.state.banks[0].enabled).toBe(true);
  mockNative.configure.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Aplicação falhou')).mockRejectedValueOnce(new Error('Ainda falhou'));
  await act(async () => { await expect(result.current.saveBanks([{ ...bank, packageName: 'bank2' }])).rejects.toThrow('Aplicação falhou'); });
  expect(result.current.state.banks[0].packageName).toBe('bank2');
  await act(async () => { await result.current.scan(); });
  expect(mockNative.configure).toHaveBeenLastCalledWith(['bank2']);
  expect(result.current.error).toBe(''); unmount();
});

it('limita o lote e mantém excesso de pendências na fila nativa', async () => {
  mockNative.read.mockResolvedValue(JSON.stringify(Array.from({ length: 60 }, (_, i) => event(`capture-${i}`, 'débito'))));
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(result.current.state.pending).toHaveLength(25));
  expect(mockNative.acknowledge).toHaveBeenLastCalledWith(expect.arrayContaining(['capture-24']));
  expect(mockNative.acknowledge.mock.calls[0][0]).not.toContain('capture-25'); unmount();
});

it('aplica limite de pendências sem reconhecer como concluídas capturas que ficaram na fila', async () => {
  const pending = Array.from({ length: 199 }, (_, i) => ({ ...event(`old-${i}`), description: 'Antiga', uncertain: true }));
  await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify({ banks: [bank], pending, handled: [] }));
  mockNative.read.mockResolvedValue(JSON.stringify([event('new-1', 'débito'), event('new-2', 'débito')]));
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(result.current.state.pending).toHaveLength(200));
  expect(mockNative.acknowledge).toHaveBeenLastCalledWith(['new-1']);
  expect(result.current.error).toContain('200'); unmount();
});

it('histórico compactado e capturas antigas exigem revisão mesmo no automático', async () => {
  const old = { ...event('old'), timestamp: Date.now() - 31 * 86400000 };
  const cutoff = Date.now();
  await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify({ banks: [bank], pending: [], handled: [], reviewBefore: cutoff }));
  mockNative.read.mockResolvedValue(JSON.stringify([old, { ...event('evicted'), timestamp: cutoff - 1000 }]));
  const { result, unmount } = renderHook(() => usePurchaseImportContext(), { wrapper });
  await waitFor(() => expect(result.current.state.pending).toHaveLength(2));
  expect(mockStore.addTransaction).not.toHaveBeenCalled(); unmount();
});
