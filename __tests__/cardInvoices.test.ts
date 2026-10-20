import { buildCardInvoices, invoiceDates, invoiceStatus, parseMoney, shiftMonth } from '../lib/cardInvoices';
import { prepareCardPayment } from '../lib/cardPayment';
import { buildFinancialIndex } from '../lib/financialIndex';
import { Account, Transaction } from '../constants/types';
const bank: Account = { id: 'bank', name: 'Conta', type: 'corrente', balance: 0, color: '#000', icon: 'wallet' };
const card: Account = { ...bank, id: 'card', type: 'cartao_credito', closingDay: 25, dueDay: 5 };
const tx = (patch: Partial<Transaction> = {}): Transaction => ({ id: 't', description: 'Compra', amount: 100, accountId: 'card', date: '2026-10-01', type: 'despesa', paid: false, recurrence: 'unica', paymentMethod: 'credito', ...patch });
const today = new Date(2026, 9, 17, 12);
it('navega por competências e limita vencimentos ao último dia do mês', () => {
    expect(shiftMonth('2026-02', 1)).toBe('2026-03');
    expect(invoiceDates('2026-02', { ...card, dueDay: 31 }).due).toBe('2026-02-28');
    const entry = buildCardInvoices([{ ...card, dueDay: 31, closingDay: 5 }], [tx({ date: '2026-02-01' })]).invoices.get('card:2026-02');
    expect(invoiceStatus(entry, '2026-03-01')).toBe('VENCIDA');
});
it('interpreta reais integralmente, sem aceitar texto ou frações de centavo', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56);
    expect(parseMoney('1234,56')).toBe(1234.56);
    for (const value of ['12abc', '1,234', '1.2', '-1', '0', 'Infinity'])
        expect(() => parseMoney(value)).toThrow();
});
it('separa cartões e competências, sem compensar crédito entre bancos', () => {
    const other = { ...card, id: 'other', dueDay: 28 };
    const index = buildCardInvoices([card, other], [tx(), tx({ id: 'other', accountId: 'other', amount: 200 }), tx({ id: 'refund', accountId: 'other', type: 'receita', amount: 300 })]);
    expect(index.invoices.get('card:2026-11')!.pending).toBe(10000);
    expect(index.invoices.get('other:2026-10')!.pending).toBe(0);
    expect(index.creditBalances.get('other')).toBe(10000);
});
it('compensa crédito antigo na projeção e não reutiliza o crédito após pagar', () => {
    const rows = [tx({ id: 'initial', accountId: 'bank', type: 'receita', amount: 1000, paid: true, paymentMethod: 'debito' }), tx(), tx({ id: 'future', amount: 200, date: '2026-11-01' }), tx({ id: 'legacy-out', accountId: 'bank', amount: 150, paid: true, paymentMethod: 'debito' }), tx({ id: 'legacy-in', type: 'receita', amount: 150 })];
    const before = buildFinancialIndex([bank, card], rows, [], today);
    expect(before.projectedBalance('2026-12')).toBe(700);
    const after = prepareCardPayment([bank, card], rows, { cardId: 'card', sourceId: 'bank', month: '2026-12', date: today }, today);
    const final = buildFinancialIndex([bank, card], after, [], today);
    expect(final.totalBalance).toBe(700);
    expect(final.cardDebt.get('card')).toBe(0);
    expect(final.cardIndex.creditBalances.get('card')).toBe(0);
});
it('limita novas antecipações à fatura escolhida e rejeita data futura', () => {
    const request = { cardId: 'card', sourceId: 'bank', month: '2026-11', date: today, amount: 150 };
    expect(() => prepareCardPayment([bank, card], [tx(), tx({ id: 'future', amount: 200, date: '2026-11-01' })], request, today)).toThrow();
    expect(() => prepareCardPayment([bank, card], [tx()], { ...request, amount: 50, date: new Date(2026, 10, 1) }, today)).toThrow();
});
it('preserva data real, competência e vínculo, quitando apenas o restante', () => {
    const partial = prepareCardPayment([bank, card], [tx()], { cardId: 'card', sourceId: 'bank', month: '2026-11', date: today, amount: 40 }, today);
    const credit = partial.find(t => t.type === 'receita')!;
    expect(credit.date).toBe('2026-10-17');
    expect(credit.invoiceMonth).toBe('2026-11');
    expect(buildCardInvoices([bank, card], partial).invoices.get('card:2026-11')!.pending).toBe(6000);
    const full = prepareCardPayment([bank, card], partial, { cardId: 'card', sourceId: 'bank', month: '2026-11', date: today }, today);
    expect(full.filter(t => t.accountId === 'bank').reduce((sum, t) => sum + t.amount, 0)).toBe(100);
    expect(buildCardInvoices([bank, card], full).invoices.get('card:2026-11')!.pending).toBe(0);
});
