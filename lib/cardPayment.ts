import { Account, Transaction } from '@/constants/types';
import { buildCardInvoices, toCents } from './cardInvoices';
import { dayKey } from './financialDate';
export interface CardPaymentRequest {
    cardId: string;
    sourceId: string | null;
    month: string;
    amount?: number;
    markOnly?: boolean;
    date: Date;
}
export function prepareCardPayment(accounts: Account[], transactions: Transaction[], request: CardPaymentRequest, today = new Date()) {
    const card = accounts.find(a => a.id === request.cardId && a.type === 'cartao_credito');
    if (!card)
        throw new Error('Cartão não encontrado.');
    if (!dayKey(request.date) || dayKey(request.date) > dayKey(today))
        throw new Error('Informe a data real do pagamento, até hoje.');
    if (!request.markOnly && !accounts.some(a => a.id === request.sourceId && a.type !== 'cartao_credito'))
        throw new Error('Selecione uma conta de origem válida.');
    const invoice = buildCardInvoices(accounts, transactions).invoices.get(`${card.id}:${request.month}`);
    if (!invoice || !invoice.rows.some(t => !t.paid) || (invoice.pending === 0 && invoice.creditApplied === 0))
        throw new Error('Esta fatura não tem saldo pendente.');
    const amount = request.amount === undefined ? invoice.pending : toCents(request.amount);
    if (!Number.isSafeInteger(amount) || amount < 0 || (request.amount !== undefined && amount === 0) || amount > invoice.pending)
        throw new Error('O valor deve ser maior que zero e não pode superar o restante desta fatura.');
    const full = request.markOnly || amount === invoice.pending;
    const id = `payment:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    const date = dayKey(request.date);
    const credit = (suffix: string, month: string, value: number, type: 'receita' | 'despesa', paid: boolean, description: string): Transaction => ({ id: `${id}:${suffix}`, cardPaymentId: id, paidCardId: card.id, invoiceMonth: month, description, amount: value / 100, accountId: card.id, type, paid, date, paymentMethod: 'credito', recurrence: 'unica' });
    const additions: Transaction[] = [];
    // Compensação explícita: consome crédito anterior sem voltar a usá-lo após quitar.
    invoice.creditsFrom.forEach((source, i) => {
        additions.push(credit(`carry-out:${i}`, source.month, source.amount, 'despesa', false, 'Crédito transferido para outra fatura'));
        additions.push(credit(`carry-in:${i}`, request.month, source.amount, 'receita', !!full, 'Crédito recebido de fatura anterior'));
    });
    if (!request.markOnly && amount > 0)
        additions.push({ id: `${id}:bank`, cardPaymentId: id, paidCardId: card.id, invoiceMonth: request.month, description: `${full ? 'Pagamento Fatura' : 'Antecipação'} - ${card.name}`, amount: amount / 100, accountId: request.sourceId!, type: 'despesa', date, paymentMethod: 'debito', paid: true, recurrence: 'unica' });
    if (!full)
        additions.push(credit('credit', request.month, amount, 'receita', false, 'Pagamento antecipado'));
    const ids = new Set(invoice.rows.map(t => t.id));
    const updated = full ? transactions.map(t => ids.has(t.id) && !t.paid ? { ...t, paid: true, settledByPaymentId: id, settledAt: date } : t) : transactions;
    return [...additions, ...updated];
}
export function reverseRecordedPayment(transactions: Transaction[], paymentId: string) {
    if (!transactions.some(t => t.cardPaymentId === paymentId || t.settledByPaymentId === paymentId))
        throw new Error('Registro de pagamento não encontrado.');
    if (transactions.some(t => t.cardPaymentId === paymentId && t.settledByPaymentId && t.settledByPaymentId !== paymentId))
        throw new Error('Estorne primeiro a quitação posterior que utilizou esta antecipação.');
    return transactions.filter(t => t.cardPaymentId !== paymentId).map(t => {
        if (t.settledByPaymentId !== paymentId)
            return t;
        const { settledByPaymentId, settledAt, ...rest } = t;
        return { ...rest, paid: false };
    });
}
