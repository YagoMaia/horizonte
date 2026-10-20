import { Account, Transaction } from '@/constants/types';
import { dayKey, financialDate } from './financialDate';
import { getInvoiceForTx } from './utils';
export const toCents = (value: number) => Math.round(value * 100);
export function parseMoney(text: string) {
    const value = text.trim();
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value))
        throw new Error('Informe o valor em reais, por exemplo 1.234,56.');
    const amount = Number(value.replace(/\./g, '').replace(',', '.'));
    if (!Number.isSafeInteger(toCents(amount)) || amount <= 0)
        throw new Error('Informe um valor maior que zero.');
    return toCents(amount) / 100;
}
export function invoiceMonth(tx: Transaction, card: Account) {
    if (tx.invoiceMonth)
        return tx.invoiceMonth;
    const invoice = getInvoiceForTx(tx.date, card);
    return `${invoice.viewYear}-${String(invoice.viewMonth + 1).padStart(2, '0')}`;
}
export function shiftMonth(month: string, offset: number) {
    const [year, number] = month.split('-').map(Number);
    return dayKey(new Date(year, number - 1 + offset, 1, 12)).slice(0, 7);
}
export function invoiceDates(month: string, card: Account) {
    const [year, number] = month.split('-').map(Number);
    const date = (m: number, day: number) => dayKey(new Date(year, m, Math.min(day, new Date(year, m + 1, 0).getDate()), 12));
    return { due: date(number - 1, card.dueDay || 5), closing: date(number - 1 - ((card.dueDay || 5) < (card.closingDay || 25) ? 1 : 0), card.closingDay || 25) };
}
export interface CardInvoice {
    cardId: string;
    month: string;
    due: string;
    closing: string;
    rows: Transaction[];
    total: number;
    rawPending: number;
    pending: number;
    creditApplied: number;
    creditsFrom: {
        month: string;
        amount: number;
    }[];
}
export function buildCardInvoices(accounts: Account[], transactions: Transaction[]) {
    const cards = new Map(accounts.filter(a => a.type === 'cartao_credito').map(a => [a.id, a]));
    const invoices = new Map<string, CardInvoice>();
    for (const tx of transactions) {
        const card = cards.get(tx.accountId);
        if (!card || tx.paymentMethod !== 'credito')
            continue;
        const month = invoiceMonth(tx, card), key = `${card.id}:${month}`;
        const entry = invoices.get(key) || { cardId: card.id, month, ...invoiceDates(month, card), rows: [], total: 0, rawPending: 0, pending: 0, creditApplied: 0, creditsFrom: [] };
        const amount = toCents(tx.amount) * (tx.type === 'receita' ? -1 : 1);
        entry.rows.push(tx);
        entry.total += amount;
        if (!tx.paid)
            entry.rawPending += amount;
        invoices.set(key, entry);
    }
    const creditBalances = new Map<string, number>();
    const debt = new Map<string, number>();
    const creditPools = new Map<string, {
        month: string;
        amount: number;
    }[]>();
    for (const entry of [...invoices.values()].sort((a, b) => a.month.localeCompare(b.month))) {
        const pool = creditPools.get(entry.cardId) || [];
        let remaining = Math.max(0, entry.rawPending);
        if (entry.rawPending < 0)
            pool.push({ month: entry.month, amount: -entry.rawPending });
        for (const credit of pool) {
            const used = Math.min(remaining, credit.amount);
            if (used)
                entry.creditsFrom.push({ month: credit.month, amount: used });
            remaining -= used;
            credit.amount -= used;
            entry.creditApplied += used;
        }
        entry.pending = remaining;
        creditPools.set(entry.cardId, pool);
        debt.set(entry.cardId, (debt.get(entry.cardId) || 0) + remaining);
        entry.rows.sort((a, b) => financialDate(b.date).getTime() - financialDate(a.date).getTime());
    }
    for (const [id, pool] of creditPools)
        creditBalances.set(id, pool.reduce((sum, c) => sum + c.amount, 0));
    return { invoices, debt, creditBalances };
}
export function invoiceStatus(invoice: CardInvoice | undefined, today: string) {
    if (!invoice || !invoice.rows.length)
        return 'SEM LANÇAMENTOS';
    if (invoice.rawPending < 0)
        return 'SALDO CREDOR';
    if (invoice.pending === 0)
        return invoice.rows.every(t => t.paid) ? 'PAGA' : 'COMPENSADA';
    if (invoice.due < today)
        return 'VENCIDA';
    if (invoice.closing <= today)
        return 'FECHADA';
    return 'ABERTA';
}
