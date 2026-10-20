// Opt-in: HORIZONTE_TEST_BACKUP points to a local file; never commit private fixtures.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseBackup, restoreBackup, createBackup } from '../lib/backup';
import { buildFinancialIndex, filterMonth, DEFAULT_SALDOS_FILTERS } from '../lib/financialIndex';
import { dayKey } from '../lib/financialDate';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useStore } from '../hooks/useStore';
import { prepareCardPayment } from '../lib/cardPayment';
jest.mock('../services/notificationService', () => ({
  scheduleDailyReminder: jest.fn(), scheduleExpenseReminder: jest.fn(), scheduleCreditCardAlert: jest.fn(),
  cancelDailyReminder: jest.fn(), cancelExpenseReminder: jest.fn(), cancelCreditCardAlert: jest.fn(),
  hasNotificationPermission: jest.fn(async () => false),
}));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const file = process.env.HORIZONTE_TEST_BACKUP;
const localTest = file ? describe : describe.skip;
localTest('backup local privado (opt-in)', () => {
  let source: any;
  beforeAll(() => { source = JSON.parse(require('fs').readFileSync(file!, 'utf8')); });
  it('valida e restaura o legado sem perder lançamentos ou contas ao reexportar', async () => {
    const parsed = parseBackup(source);
    await AsyncStorage.clear();
    await restoreBackup(source);
    const exported = await createBackup();
    // Comparações booleanas evitam despejar dados pessoais se houver falha.
    expect(JSON.stringify(exported.data) === JSON.stringify(parsed.data)).toBe(true);
    expect(exported.data.transactions.length === source.data.transactions.length).toBe(true);
    expect(exported.data.accounts.length === source.data.accounts.length).toBe(true);
  });
  it('confere saldos por conta contra cálculo independente e cobre todos os meses', () => {
    const { data } = parseBackup(source);
    const date = new Date(source.timestamp);
    const index = buildFinancialIndex(data.accounts, data.transactions, data.goals, date);
    let total = 0;
    for (const account of data.accounts.filter(a => a.type !== 'cartao_credito')) {
      let expected = 0;
      for (const tx of data.transactions) {
        if (!tx.paid || dayKey(tx.date) > dayKey(date)) continue;
        const amount = Math.round(tx.amount * 100);
        if (tx.accountId === account.id) expected += tx.type === 'receita' ? amount : -amount;
        if (tx.type === 'transferencia' && tx.targetAccountId === account.id) expected += amount;
      }
      expect(Math.round(index.balances.get(account.id)! * 100) === expected).toBe(true);
      total += expected;
    }
    expect(Math.round(index.totalBalance * 100) === total).toBe(true);
    expect([...index.months.values()].reduce((n, list) => n + list.length, 0) === data.transactions.length).toBe(true);
    for (const month of index.months.keys()) {
      expect(Number.isFinite(index.projectedBalance(month))).toBe(true);
      const rows = filterMonth(index, month, { ...DEFAULT_SALDOS_FILTERS, includeAdjustments: true });
      expect(rows.every(tx => dayKey(tx.date).startsWith(month))).toBe(true);
    }
  });
  it('abre a base no aplicativo sem alterar lançamentos ou baixar pendências', async () => {
    await AsyncStorage.clear();
    const data = await restoreBackup(source);
    const hook = renderHook(() => useStore());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(JSON.stringify(hook.result.current.transactions) === JSON.stringify(data.transactions)).toBe(true);
    expect(hook.result.current.accounts.length === data.accounts.length).toBe(true);
    hook.unmount();
  });
  it('simula pagamento na base privada e concilia a saída com a redução da dívida', () => {
    const { data } = parseBackup(source);
    const date = new Date(source.timestamp);
    const before = buildFinancialIndex(data.accounts, data.transactions, data.goals, date);
    const invoice = [...before.cardIndex.invoices.values()].find(i => i.pending > 0)!;
    const bank = data.accounts.find(a => a.type !== 'cartao_credito')!;
    const amount = Math.max(1, Math.floor(invoice.pending / 2)) / 100;
    const next = prepareCardPayment(data.accounts, data.transactions, { cardId: invoice.cardId, sourceId: bank.id, month: invoice.month, amount, date }, date);
    const after = buildFinancialIndex(data.accounts, next, data.goals, date);
    expect(Math.round((before.totalBalance - after.totalBalance) * 100) === Math.round(amount * 100)).toBe(true);
    expect(before.cardIndex.debt.get(invoice.cardId)! - after.cardIndex.debt.get(invoice.cardId)! === Math.round(amount * 100)).toBe(true);
    expect(source.data.transactions.length === data.transactions.length).toBe(true);
  });
});
