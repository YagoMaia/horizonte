import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_IMPORT, IMPORT_KEY, ImportState, MAX_HANDLED_IMPORTS, MAX_PENDING_IMPORTS, PurchaseCandidate, validatePurchaseBanks } from './purchaseImport';
const prefix = '@horizonte:purchase_pending:';
const key = (id: string) => prefix + encodeURIComponent(id);

// Notification bodies live in individual rows; the bounded index is cheap to update.
export async function savePurchaseImport(next: ImportState, previous: ImportState = EMPTY_IMPORT, migrating = false) {
  if (!migrating && next.pending.length > MAX_PENDING_IMPORTS && next.pending.length > previous.pending.length) throw new Error('Resolva as compras pendentes antes de importar mais.');
  const old = new Map(previous.pending.map(item => [item.id, item]));
  const writes: [string, string][] = next.pending.filter(item => old.get(item.id) !== item).map(item => [key(item.id), JSON.stringify(item)]);
  if (writes.length) await AsyncStorage.multiSet(writes);
  const unique = [...new Set(next.handled)], handled = unique.slice(-MAX_HANDLED_IMPORTS);
  // Once IDs are evicted, older deliveries can only be reviewed, never imported automatically.
  const reviewBefore = unique.length > MAX_HANDLED_IMPORTS ? Math.max(next.reviewBefore || 0, Date.now()) : next.reviewBefore;
  await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify({ version: 2, banks: next.banks, pendingIds: next.pending.map(item => item.id), handled, reviewBefore }));
  const ids = new Set(next.pending.map(item => item.id));
  const removed = previous.pending.filter(item => !ids.has(item.id)).map(item => key(item.id));
  // Orphans after a failed removal are safe and cleaned on next startup.
  if (removed.length) await AsyncStorage.multiRemove(removed).catch(() => undefined);
  return { ...next, handled, reviewBefore };
}
export async function loadPurchaseImport(): Promise<ImportState> {
  const raw = await AsyncStorage.getItem(IMPORT_KEY);
  if (!raw) return { ...EMPTY_IMPORT };
  const saved = JSON.parse(raw);
  if (!Array.isArray(saved.banks) || !Array.isArray(saved.handled) || !saved.handled.every((id: unknown) => typeof id === 'string')) throw new Error('Configurações de importação inválidas.');
  validatePurchaseBanks(saved.banks);
  let pending: PurchaseCandidate[];
  if (saved.version === 2) {
    if (!Array.isArray(saved.pendingIds) || !saved.pendingIds.every((id: unknown) => typeof id === 'string')) throw new Error('Índice de capturas inválido.');
    const rows = await AsyncStorage.multiGet(saved.pendingIds.map(key));
    pending = rows.map(([, value]) => { if (!value) throw new Error('Captura pendente ausente.'); return JSON.parse(value); });
  } else {
    if (!Array.isArray(saved.pending)) throw new Error('Capturas inválidas.');
    pending = saved.pending;
  }
  if (!pending.every(item => item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.title === 'string' && typeof item.packageName === 'string' && Number.isFinite(item.timestamp))) throw new Error('Captura inválida.');
  if (saved.reviewBefore !== undefined && (!Number.isFinite(saved.reviewBefore) || saved.reviewBefore < 0)) throw new Error('Histórico de capturas inválido.');
  const state: ImportState = { banks: saved.banks, pending, handled: saved.handled, reviewBefore: saved.reviewBefore };
  // Migrate without losing legacy overflow: new captures wait until the user resolves it.
  const normalized = saved.version !== 2 || saved.handled.length > MAX_HANDLED_IMPORTS ? await savePurchaseImport(state, EMPTY_IMPORT, true) : state;
  const retained = new Set(pending.map(item => key(item.id)));
  const orphaned = (await AsyncStorage.getAllKeys()).filter(item => item.startsWith(prefix) && !retained.has(item));
  if (orphaned.length) await AsyncStorage.multiRemove(orphaned);
  return normalized;
}
export async function clearPurchaseImportStorage() {
  const pending = (await AsyncStorage.getAllKeys()).filter(item => item.startsWith(prefix));
  await AsyncStorage.multiRemove([IMPORT_KEY, ...pending]);
}
