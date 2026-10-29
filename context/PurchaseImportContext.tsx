import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStoreContext } from './StoreContext';
import { captureNative } from '@/services/purchaseCapture';
import { EMPTY_IMPORT, IMPORT_BATCH_SIZE, MAX_PENDING_IMPORTS, ImportState, PurchaseBank, PurchaseCandidate, PurchaseKind, PurchaseReviewOptions, parsePurchase, destinationFor, validatePurchaseBanks, PossiblePurchaseDuplicateError } from '@/lib/purchaseImport';
import { loadPurchaseImport, savePurchaseImport, clearPurchaseImportStorage } from '@/lib/purchaseImportStorage';
import { IMPORT_RESET_KEY, isPurchaseImportPaused, registerImportResetHandler } from '@/lib/purchaseImportLifecycle';
import { dayKey } from '@/lib/financialDate';
import { MAX_RECURRENCES } from '@/lib/transactionInput';

function usePurchaseImport() {
  const store = useStoreContext(), current = useRef(store); current.current = store;
  const [state, setState] = useState<ImportState>(EMPTY_IMPORT);
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [access, setAccess] = useState(false), [dropped, setDropped] = useState(0);
  const data = useRef(state), queue = useRef(Promise.resolve()), scanning = useRef<Promise<void> | null>(null);
  const initialized = useRef(false), native = useRef(captureNative()).current;
  const configuredPackages = useRef<string | null>(null);
  const enqueue = useCallback(<T,>(fn: () => Promise<T>) => {
    const result = queue.current.then(fn); queue.current = result.then(() => undefined, () => undefined); return result;
  }, []);
  const save = useCallback(async (next: ImportState) => {
    const saved = await savePurchaseImport(next, data.current); data.current = saved; setState(saved);
  }, []);
  const configure = useCallback(async (banks: PurchaseBank[]) => {
    const packages = banks.filter(b => b.enabled && (b.credito.mode !== 'off' || b.debito.mode !== 'off')).map(b => b.packageName).sort();
    const signature = JSON.stringify(packages);
    if (configuredPackages.current === signature) return;
    await native?.configure(packages); configuredPackages.current = signature;
  }, [native]);
  const record = useCallback(async (candidate: PurchaseCandidate, kind: PurchaseKind, accountId: string, amount: number, description: string, options: PurchaseReviewOptions = {}) => {
    if (isPurchaseImportPaused() || !initialized.current) throw new Error('Importação pausada. Aguarde a limpeza dos dados.');
    const account = current.current.accounts.find(a => a.id === accountId && (kind === 'credito' ? a.type === 'cartao_credito' : a.type !== 'cartao_credito'));
    if (!account) throw new Error('Escolha uma conta compatível com a modalidade.');
    const count = options.installments ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > MAX_RECURRENCES || (count > 1 && kind !== 'credito')) throw new Error(`Use de 1 a ${MAX_RECURRENCES} parcelas somente no crédito.`);
    if (count > 1 && !options.amountBasis) throw new Error('Informe se o valor é o total ou o valor de cada parcela.');
    const totalCents = Math.round(amount * 100) * (options.amountBasis === 'installment' ? count : 1);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(totalCents) || totalCents < count) throw new Error('Informe um valor válido para a compra.');
    await current.current.addTransaction({ description: description.trim() || 'Compra importada', amount: totalCents / 100, type: 'despesa', accountId, paymentMethod: kind, paid: kind === 'debito', recurrence: 'unica', date: dayKey(new Date(candidate.timestamp)), notificationImportId: candidate.id, notificationImportOverride: options.confirmDuplicate === true, ...(count > 1 ? { totalInstallments: count } : {}) });
  }, []);
  const scan = useCallback(() => {
    // A slow batch must not build up a queue of timer/foreground requests.
    if (scanning.current) return scanning.current;
    const result = enqueue(async () => {
      if (!native || !initialized.current || current.current.loading || isPurchaseImportPaused()) return;
      let next = data.current;
      const acknowledgements: string[] = [];
      let failure = '';
      try {
        // Reconcile on every entry; failed settings updates never allow stale capture rules to persist unnoticed.
        await configure(next.banks);
        setAccess(await native.hasAccess()); setDropped(await native.dropped());
        const events: unknown = JSON.parse(await native.read());
        if (!Array.isArray(events)) throw new Error('Fila inválida.');
        const known = new Set([...next.handled, ...next.pending.map(p => p.id)]);
        for (const event of events.slice(0, IMPORT_BATCH_SIZE)) {
          if (isPurchaseImportPaused()) break;
          if (!event || typeof event.id !== 'string') throw new Error('Captura inválida.');
          if (known.has(event.id)) { acknowledgements.push(event.id); continue; }
          const bank = next.banks.find(b => b.enabled && b.packageName === event.packageName);
          let candidate = bank ? parsePurchase(event) : null;
          if (candidate && bank) {
            const rule = candidate.kind ? bank[candidate.kind] : undefined;
            const disabled = rule ? rule.mode === 'off' : bank.credito.mode === 'off' && bank.debito.mode === 'off';
            if (!disabled) {
              // Backpressure: retain raw events in the native queue instead of discarding pending purchases.
              if (next.pending.length >= MAX_PENDING_IMPORTS) { failure = 'Resolva as 200 compras pendentes para continuar a importação.'; break; }
              const account = destinationFor(candidate, rule, current.current.accounts);
              let imported = false;
              if (!candidate.uncertain && rule?.mode === 'auto' && account && candidate.timestamp > (next.reviewBefore || 0) && candidate.timestamp >= Date.now() - 30 * 86400000) {
                try { await record(candidate, candidate.kind!, account.id, candidate.amount!, candidate.description); imported = true; }
                catch (e) {
                  if (!(e instanceof PossiblePurchaseDuplicateError)) throw e;
                  candidate = { ...candidate, possibleDuplicate: true, reason: e.message };
                }
              }
              if (!imported) {
                candidate = { ...candidate, reason: candidate.reason || (!account ? 'Confira o destino: final ausente, não associado ou conta indisponível.' : 'Confira modalidade, valor, data e parcelas antes de confirmar.') };
                next = { ...next, pending: [...next.pending, candidate] };
                known.add(event.id); acknowledgements.push(event.id); continue;
              }
            }
          }
          next = { ...next, handled: [...next.handled, event.id] };
          known.add(event.id); acknowledgements.push(event.id);
        }
      } catch { failure = 'Não foi possível processar as compras. Tente atualizar novamente.'; }
      // Persist decisions in one small batch; only then remove events from the durable native queue.
      try {
        if (next !== data.current) await save(next);
        if (acknowledgements.length) await native.acknowledge(acknowledgements);
      } catch { failure = 'Não foi possível salvar as capturas. Elas serão verificadas novamente.'; }
      setError(failure);
    });
    scanning.current = result;
    void result.finally(() => { scanning.current = null; });
    return result;
  }, [configure, enqueue, native, record, save]);
  useEffect(() => {
    let active = true;
    void enqueue(async () => {
      try {
        if (await AsyncStorage.getItem(IMPORT_RESET_KEY)) {
          await native?.configure([]);
          throw new Error('A limpeza anterior foi interrompida. Repita Apagar todos os dados para concluir.');
        }
        const next = await loadPurchaseImport();
        if (active) { data.current = next; setState(next); initialized.current = true; setReady(true); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível ler as configurações de importação.'); }
    });
    return () => { active = false; };
  }, [enqueue, native]);
  useEffect(() => registerImportResetHandler(() => enqueue(async () => {
    // The shared barrier is already held. Drain in-flight records before erasing financial data.
    configuredPackages.current = null;
    await native?.configure([]); await native?.clear(); configuredPackages.current = '[]'; await clearPurchaseImportStorage();
    data.current = EMPTY_IMPORT; setState(EMPTY_IMPORT); initialized.current = true; setReady(true); setError('');
  })), [enqueue, native]);
  useEffect(() => {
    if (!ready || store.loading) return;
    void scan();
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void scan(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void scan(); }, 10000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [ready, store.loading, scan]);
  const saveBanks = (banks: PurchaseBank[]) => enqueue(async () => {
    if (!native || !initialized.current || isPurchaseImportPaused()) throw new Error('Importação indisponível. Aguarde ou use o APK Android atualizado.');
    validatePurchaseBanks(banks);
    // Disable capture first. If a stage fails, reapply durable settings before reporting the failure.
    configuredPackages.current = null;
    await native.configure([]); configuredPackages.current = '[]';
    try { await save({ ...data.current, banks }); await configure(banks); setError(''); }
    catch (e) {
      try { await configure(data.current.banks); } catch { setError('Captura pausada ou com regras pendentes. Toque em Atualizar para tentar novamente.'); }
      throw e;
    }
  });
  const review = (candidate: PurchaseCandidate, kind: PurchaseKind, accountId: string, amount: number, description: string, options: PurchaseReviewOptions = {}) => enqueue(async () => {
    const pending = data.current.pending.find(p => p.id === candidate.id);
    if (!pending) throw new Error('Esta compra já foi resolvida. Atualize a lista.');
    if (pending.possibleDuplicate && !options.confirmDuplicate) throw new PossiblePurchaseDuplicateError();
    try { await record(pending, kind, accountId, amount, description, options); }
    catch (e) {
      if (e instanceof PossiblePurchaseDuplicateError) await save({ ...data.current, pending: data.current.pending.map(p => p.id === pending.id ? { ...p, possibleDuplicate: true, reason: e.message } : p) });
      throw e;
    }
    await save({ ...data.current, pending: data.current.pending.filter(p => p.id !== pending.id), handled: [...data.current.handled, pending.id] });
  });
  const dismiss = (id: string) => enqueue(() => {
    if (isPurchaseImportPaused() || !initialized.current) throw new Error('Importação pausada.');
    return save({ ...data.current, pending: data.current.pending.filter(p => p.id !== id), handled: [...data.current.handled, id] });
  });
  return { state, error, access, ready, dropped, supported: !!native, scan, saveBanks, review, dismiss };
}
const Context = createContext<ReturnType<typeof usePurchaseImport> | null>(null);
export function PurchaseImportProvider({ children }: { children: React.ReactNode }) { const value = usePurchaseImport(); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function usePurchaseImportContext() { const value = useContext(Context); if (!value) throw new Error('PurchaseImportProvider ausente.'); return value; }
