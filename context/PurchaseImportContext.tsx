import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStoreContext } from './StoreContext';
import { captureNative } from '@/services/purchaseCapture';
import { EMPTY_IMPORT, IMPORT_KEY, ImportState, PurchaseBank, PurchaseCandidate, PurchaseKind, parsePurchase } from '@/lib/purchaseImport';
import { dayKey } from '@/lib/financialDate';

function usePurchaseImport() {
  const store = useStoreContext(), current = useRef(store); current.current = store;
  const [state, setState] = useState<ImportState>(EMPTY_IMPORT);
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [access, setAccess] = useState(false), [dropped, setDropped] = useState(0);
  const data = useRef(state), queue = useRef(Promise.resolve());
  const native = captureNative();
  const enqueue = useCallback(<T,>(fn: () => Promise<T>) => {
    const result = queue.current.then(fn); queue.current = result.then(() => undefined, () => undefined); return result;
  }, []);
  const save = useCallback(async (next: ImportState) => { await AsyncStorage.setItem(IMPORT_KEY, JSON.stringify(next)); data.current = next; setState(next); }, []);
  const record = useCallback(async (candidate: PurchaseCandidate, kind: PurchaseKind, accountId: string, amount: number, description: string) => {
    const account = current.current.accounts.find(a => a.id === accountId && (kind === 'credito' ? a.type === 'cartao_credito' : a.type !== 'cartao_credito'));
    if (!account) throw new Error('Escolha uma conta compatível com a modalidade.');
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) throw new Error('Informe um valor válido.');
    await current.current.addTransaction({ description: description.trim() || 'Compra importada', amount, type: 'despesa', accountId, paymentMethod: kind, paid: kind === 'debito', recurrence: 'unica', date: dayKey(new Date(candidate.timestamp)), notificationImportId: candidate.id });
  }, []);
  const scan = useCallback(() => enqueue(async () => {
    if (!native || current.current.loading) return;
    try {
      setAccess(await native.hasAccess()); setDropped(await native.dropped());
      const events: PurchaseCandidate[] = JSON.parse(await native.read());
      for (const event of events) {
        if (data.current.handled.includes(event.id) || data.current.pending.some(p => p.id === event.id)) { await native.acknowledge([event.id]); continue; }
        const bank = data.current.banks.find(b => b.enabled && b.packageName === event.packageName);
        const candidate = bank ? parsePurchase(event) : null;
        if (candidate && bank) {
          const rule = candidate.kind ? bank[candidate.kind] : undefined;
          const disabled = rule ? rule.mode === 'off' : bank.credito.mode === 'off' && bank.debito.mode === 'off';
          if (!disabled) {
            const account = current.current.accounts.find(a => a.id === rule?.accountId && (candidate.kind === 'credito' ? a.type === 'cartao_credito' : a.type !== 'cartao_credito'));
            if (!candidate.uncertain && rule?.mode === 'auto' && account) await record(candidate, candidate.kind!, account.id, candidate.amount!, candidate.description);
            else { await save({ ...data.current, pending: [...data.current.pending, candidate] }); await native.acknowledge([event.id]); continue; }
          }
        }
        await save({ ...data.current, handled: [...data.current.handled, event.id] });
        await native.acknowledge([event.id]);
      }
      setError('');
    } catch { setError('Não foi possível processar as compras. Tente atualizar novamente.'); }
  }), [enqueue, native, record, save]);
  useEffect(() => { let active = true; void (async () => {
    try {
      const raw = await AsyncStorage.getItem(IMPORT_KEY);
      const next: ImportState = raw ? JSON.parse(raw) : EMPTY_IMPORT;
      if (!Array.isArray(next.banks) || !Array.isArray(next.pending) || !Array.isArray(next.handled)) throw new Error('Invalid');
      if (active) { data.current = next; setState(next); setReady(true); }
    } catch { if (active) setError('Não foi possível ler as configurações de importação. Reinicie o app para tentar novamente.'); }
  })(); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!ready || store.loading) return;
    void scan();
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void scan(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void scan(); }, 10000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [ready, store.loading, scan]);
  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('horizonte:clear-import', () => {
      void enqueue(async () => { await native?.clear(); await save(EMPTY_IMPORT); }).catch(() => setError('Não foi possível limpar as capturas. Desative o acesso nas configurações Android.'));
    });
    return () => listener.remove();
  }, [enqueue, native, save]);
  const saveBanks = (banks: PurchaseBank[]) => enqueue(async () => {
    if (!native || !ready) throw new Error('Use o APK Android atualizado.');
    // Persist settings before permitting capture. Capture never starts from opening the screen alone.
    await save({ ...data.current, banks });
    await native.configure(banks.filter(b => b.enabled && (b.credito.mode !== 'off' || b.debito.mode !== 'off')).map(b => b.packageName));
  });
  const review = (candidate: PurchaseCandidate, kind: PurchaseKind, accountId: string, amount: number, description: string) => enqueue(async () => {
    await record(candidate, kind, accountId, amount, description);
    await save({ ...data.current, pending: data.current.pending.filter(p => p.id !== candidate.id), handled: [...data.current.handled, candidate.id] });
  });
  const dismiss = (id: string) => enqueue(() => save({ ...data.current, pending: data.current.pending.filter(p => p.id !== id), handled: [...data.current.handled, id] }));
  return { state, error, access, ready, dropped, supported: !!native, scan, saveBanks, review, dismiss };
}
const Context = createContext<ReturnType<typeof usePurchaseImport> | null>(null);
export function PurchaseImportProvider({ children }: { children: React.ReactNode }) { const value = usePurchaseImport(); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function usePurchaseImportContext() { const value = useContext(Context); if (!value) throw new Error('PurchaseImportProvider ausente.'); return value; }
