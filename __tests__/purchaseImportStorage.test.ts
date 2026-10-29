import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPurchaseImportStorage, loadPurchaseImport, savePurchaseImport } from '../lib/purchaseImportStorage';
import { EMPTY_IMPORT, IMPORT_KEY, MAX_HANDLED_IMPORTS, MAX_PENDING_IMPORTS, PurchaseCandidate } from '../lib/purchaseImport';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const candidate = (id: string): PurchaseCandidate => ({ id, packageName: 'bank', title: 'Banco', text: 'Compra R$ 1,00', timestamp: Date.now(), description: 'Compra', uncertain: true });
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });
it('migra pendências antigas sem perder corpos e mantém o índice sem texto financeiro', async () => {
  const pending = [candidate('one'), candidate('two')];
  await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify({ banks: [], pending, handled: ['done'] }));
  expect((await loadPurchaseImport()).pending).toEqual(pending);
  const index = JSON.parse((await AsyncStorage.getItem(IMPORT_KEY))!);
  expect(index.pendingIds).toEqual(['one', 'two']); expect(index.pending).toBeUndefined();
  expect((await loadPurchaseImport()).pending).toEqual(pending);
});
it('salva somente novos corpos, limita histórico e remove pendências resolvidas', async () => {
  const first = await savePurchaseImport({ ...EMPTY_IMPORT, pending: [candidate('one')] });
  jest.mocked(AsyncStorage.multiSet).mockClear();
  const next = await savePurchaseImport({ ...first, pending: [...first.pending, candidate('two')], handled: Array.from({ length: 5000 }, (_, i) => String(i)) }, first);
  const bodyWrites = jest.mocked(AsyncStorage.multiSet).mock.calls.flatMap(call => call[0]).filter(([key]) => key.startsWith('@horizonte:purchase_pending:'));
  expect(bodyWrites).toHaveLength(1);
  expect(bodyWrites[0][0]).toContain(':two');
  expect(next.handled).toHaveLength(MAX_HANDLED_IMPORTS);
  expect(next.reviewBefore).toBeGreaterThan(0);
  await savePurchaseImport({ ...next, pending: next.pending.slice(1) }, next);
  expect((await loadPurchaseImport()).pending.map(p => p.id)).toEqual(['two']);
  expect((await AsyncStorage.getAllKeys()).some(key => key.endsWith(':one'))).toBe(false);
});
it('não descarta legado acima do limite e impede aumentar o acúmulo', async () => {
  const pending = Array.from({ length: MAX_PENDING_IMPORTS + 1 }, (_, i) => candidate(String(i)));
  await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify({ banks: [], pending, handled: [] }));
  const state = await loadPurchaseImport(); expect(state.pending).toHaveLength(MAX_PENDING_IMPORTS + 1);
  await expect(savePurchaseImport({ ...state, pending: [...state.pending, candidate('extra')] }, state)).rejects.toThrow('Resolva');
  await savePurchaseImport({ ...state, pending: state.pending.slice(1) }, state);
  expect((await loadPurchaseImport()).pending).toHaveLength(MAX_PENDING_IMPORTS);
});
it('falha no índice preserva estado anterior e limpeza remove corpos órfãos', async () => {
  await savePurchaseImport({ ...EMPTY_IMPORT, pending: [candidate('one')] });
  const previous = await loadPurchaseImport();
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Disco cheio'));
  await expect(savePurchaseImport({ ...previous, pending: [...previous.pending, candidate('two')] }, previous)).rejects.toThrow('Disco cheio');
  expect((await loadPurchaseImport()).pending.map(p => p.id)).toEqual(['one']);
  expect((await AsyncStorage.getAllKeys()).some(key => key.endsWith(':two'))).toBe(false);
  await clearPurchaseImportStorage(); expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
