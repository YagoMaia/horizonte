import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../hooks/useStore';
import { recoverLedgerWrite } from '../lib/ledgerStorage';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../services/notificationService', () => ({ scheduleDailyReminder: jest.fn(), scheduleExpenseReminder: jest.fn(), scheduleCreditCardAlert: jest.fn(), cancelDailyReminder: jest.fn(), cancelExpenseReminder: jest.fn(), cancelCreditCardAlert: jest.fn(), hasNotificationPermission: jest.fn(async () => false) }));
const accounts = [{ id: 'bank', name: 'Conta', type: 'corrente', balance: 0, color: '#000', icon: 'wallet' }, { id: 'card', name: 'Cartão', type: 'cartao_credito', balance: 0, color: '#000', icon: 'card', closingDay: 25, dueDay: 5 }];
const rows = [{ id: 'initial', accountId: 'bank', description: 'Saldo inicial', amount: 1000, type: 'receita', paymentMethod: 'debito', date: '2020-01-01', paid: true, recurrence: 'unica' }, { id: 'purchase', accountId: 'card', description: 'Compra', amount: 100, type: 'despesa', paymentMethod: 'credito', date: '2020-01-01', paid: false, recurrence: 'unica' }];
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); await AsyncStorage.multiSet([['@horizonte:accounts', JSON.stringify(accounts)], ['@horizonte:transactions', JSON.stringify(rows)]]); });
async function open() { const h = renderHook(() => useStore()); await waitFor(() => expect(h.result.current.loading).toBe(false)); return h; }
it('bloqueia pagamento simultâneo e não debita novamente uma fatura quitada', async () => {
    const h = await open();
    let results: PromiseSettledResult<void>[] = [];
    await act(async () => { results = await Promise.allSettled([h.result.current.payCreditCardInvoice('card', 'bank', 1, 2020), h.result.current.payCreditCardInvoice('card', 'bank', 1, 2020)]); });
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(h.result.current.totalBalance).toBe(900);
    await act(async () => { await expect(h.result.current.payCreditCardInvoice('card', 'bank', 1, 2020)).rejects.toThrow(); });
    expect(h.result.current.transactions.filter(t => t.paidCardId === 'card' && t.accountId === 'bank')).toHaveLength(1);
    h.unmount();
});
it('desfaz escrita parcial em disco e mantém o estado anterior quando falha', async () => {
    const h = await open();
    const before = await AsyncStorage.multiGet(['@horizonte:transactions', '@horizonte:accounts']);
    (AsyncStorage.multiSet as jest.Mock).mockImplementationOnce(async (pairs: [
        string,
        string
    ][]) => { await AsyncStorage.setItem(pairs[0][0], pairs[0][1]); throw new Error('Falha simulada'); });
    await act(async () => { await expect(h.result.current.payCreditCardInvoice('card', 'bank', 1, 2020)).rejects.toThrow('Falha simulada'); });
    expect(await AsyncStorage.multiGet(['@horizonte:transactions', '@horizonte:accounts'])).toEqual(before);
    expect(h.result.current.totalBalance).toBe(1000);
    h.unmount();
});
it('recupera diário interrompido antes de continuar', async () => {
    const before = await AsyncStorage.multiGet(['@horizonte:transactions', '@horizonte:accounts']);
    await AsyncStorage.setItem('@horizonte:ledger_journal', JSON.stringify(before));
    await AsyncStorage.setItem('@horizonte:transactions', '[]');
    await recoverLedgerWrite();
    expect(await AsyncStorage.multiGet(['@horizonte:transactions', '@horizonte:accounts'])).toEqual(before);
});
it('estorna quitação e antecipação em ordem sem perder os lançamentos originais', async () => {
    const h = await open();
    await act(async () => { await h.result.current.anticipateCreditCardPayment('card', 'bank', 40, 1, 2020); });
    const partial = h.result.current.transactions.find(t => t.cardPaymentId)!.cardPaymentId!;
    await act(async () => { await h.result.current.payCreditCardInvoice('card', 'bank', 1, 2020); });
    const full = h.result.current.transactions.find(t => t.id === 'purchase')!.settledByPaymentId!;
    await act(async () => { await expect(h.result.current.reverseCardPayment(partial)).rejects.toThrow('primeiro'); });
    await act(async () => { await h.result.current.reverseCardPayment(full); });
    expect(h.result.current.totalBalance).toBe(960);
    await act(async () => { await h.result.current.reverseCardPayment(partial); });
    expect(h.result.current.totalBalance).toBe(1000);
    expect(h.result.current.transactions).toEqual(rows);
    h.unmount();
});
it('exclusão de uma fatura não expande IDs com hífen arbitrário', async () => {
    await AsyncStorage.setItem('@horizonte:transactions', JSON.stringify([{ ...rows[1], id: 'uuid-one' }, { ...rows[1], id: 'uuid-two' }]));
    const h = await open();
    await act(async () => { await h.result.current.deleteMultipleTransactions(['uuid-one'], 'family'); });
    expect(h.result.current.transactions.map(t => t.id)).toEqual(['uuid-two']);
    h.unmount();
});
