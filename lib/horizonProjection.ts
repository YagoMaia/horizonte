import { Account, Transaction } from '@/constants/types';
import { buildCardInvoices } from './cardInvoices';
import { dayKey, financialDate } from './financialDate';

export interface HorizonDayProjection {
  day: number;
  weekDay: string;
  income: number;
  expense: number;
  variableExpense: number;
  dailyPlan: number;
  balance: number;
  isPast: boolean;
  isToday: boolean;
  fullDate: string;
  transactions: Transaction[];
}

export interface HorizonProjectionInput {
  accounts: Account[];
  transactions: Transaction[];
  activeAccountIds: string[];
  year: number;
  month: number;
  today: Date;
  getBudget: (year: number, month: number) => number;
  includeCardInvoices: boolean;
  monthsAhead?: number;
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const monthId = (year: number, month: number) => `${year}-${month}`;
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
const cashDelta = (tx: Transaction, active: Set<string>) => {
  const from = active.has(tx.accountId);
  const to = tx.type === 'transferencia' && !!tx.targetAccountId && active.has(tx.targetAccountId);
  if (tx.type === 'receita') return from ? tx.amount : 0;
  if (tx.type === 'despesa') return from ? -tx.amount : 0;
  return (from ? -tx.amount : 0) + (to ? tx.amount : 0);
};

/** Aceita 1.234,56 e 0,00; orçamento não pode ser negativo. */
export function parseBudgetMoney(text: string) {
  const value = text.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) {
    throw new Error('Informe o orçamento em reais, por exemplo 1.234,56.');
  }
  const amount = Number(value.replace(/\./g, '').replace(',', '.'));
  if (!Number.isSafeInteger(Math.round(amount * 100)) || amount < 0) {
    throw new Error('Informe um orçamento igual ou maior que zero.');
  }
  return Math.round(amount * 100) / 100;
}

/** No mês atual, faturas entram no vencimento; nos meses futuros, ficam reservadas no dia 1. */
export function buildHorizonProjection(input: HorizonProjectionInput) {
  const monthsAhead = input.monthsAhead ?? 2;
  const today = startOfDay(input.today);
  const startIsPast = input.year < today.getFullYear() || (input.year === today.getFullYear() && input.month < today.getMonth());
  const start = new Date(startIsPast ? input.year : today.getFullYear(), startIsPast ? input.month : today.getMonth(), 1, 12);
  const end = new Date(input.year, input.month + monthsAhead + 1, 0, 12);
  const active = new Set(input.activeAccountIds.filter(id => input.accounts.some(account => account.id === id && account.type !== 'cartao_credito')));
  const selectedAccounts = input.accounts.filter(account => active.has(account.id));
  const eventByDay = new Map<string, Transaction[]>();
  const add = (date: Date, tx: Transaction) => {
    if (date < start || date > end) return;
    const key = dayKey(date);
    const rows = eventByDay.get(key) || [];
    rows.push(tx);
    eventByDay.set(key, rows);
  };
  const originalDay = (tx: Transaction) => financialDate(tx.date);
  const effectiveDay = (tx: Transaction) => {
    const date = originalDay(tx);
    if (tx.paid && date > today) return today;
    if (!tx.paid && date < today) return today;
    return date;
  };

  // O saldo atual já contém os lançamentos realizados até hoje. Voltamos ao início do recorte.
  let openingBalance = selectedAccounts.reduce((sum, account) => sum + account.balance, 0);
  for (const tx of input.transactions) {
    if (!tx.paid || tx.paymentMethod === 'credito') continue;
    const date = originalDay(tx);
    if (date >= start && date <= today) openingBalance -= cashDelta(tx, active);
  }

  for (const tx of input.transactions) {
    if (tx.paymentMethod === 'credito') continue;
    const from = active.has(tx.accountId);
    const to = tx.type === 'transferencia' && !!tx.targetAccountId && active.has(tx.targetAccountId);
    if (from || to) add(effectiveDay(tx), tx);
  }

  // Sem conta de caixa selecionada não há um saldo agregado que possa pagar a fatura.
  if (input.includeCardInvoices && active.size) {
    const invoices = buildCardInvoices(input.accounts, input.transactions);
    for (const invoice of invoices.invoices.values()) {
      if (invoice.pending <= 0) continue;
      const due = financialDate(invoice.due);
      const futureMonth = invoice.month > dayKey(today).slice(0, 7);
      const impactDate = futureMonth ? new Date(due.getFullYear(), due.getMonth(), 1, 12) : due < today ? today : due;
      const card = input.accounts.find(account => account.id === invoice.cardId);
      add(impactDate, {
        id: `virtual-invoice-${invoice.cardId}-${invoice.month}`,
        description: futureMonth ? `Fatura de ${card?.name || 'cartão'} — reserva do mês` : 'Fatura de cartão',
        amount: invoice.pending / 100,
        type: 'despesa',
        date: impactDate.toISOString(),
        accountId: invoice.cardId,
        recurrence: 'unica',
        paid: false,
        paymentMethod: 'debito',
        isVirtual: true,
      });
    }
  }

  const result: Record<string, HorizonDayProjection[]> = {};
  let runningBalance = openingBalance;
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12)) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const key = monthId(year, month);
    result[key] = [];
    const budget = input.getBudget(year, month);
    let fixedExpense = 0;
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      for (const tx of eventByDay.get(dayKey(new Date(year, month, day, 12))) || []) {
        if (tx.isAdjustment || tx.paymentMethod === 'credito') continue;
        const from = active.has(tx.accountId) || !!tx.isVirtual;
        const to = tx.type === 'transferencia' && !!tx.targetAccountId && active.has(tx.targetAccountId);
        const fixed = tx.isVirtual || (tx.recurrence && tx.recurrence !== 'unica');
        if ((tx.type === 'despesa' && from && fixed) || (tx.type === 'transferencia' && from && !to)) fixedExpense += tx.amount;
      }
    }
    let variableSpent = 0;
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const date = new Date(year, month, day, 12);
      const rows = eventByDay.get(dayKey(date)) || [];
      const visibleRows = rows.filter(tx => !tx.isAdjustment);
      let income = 0, fixed = 0, variable = 0, adjustment = 0;
      for (const tx of rows) {
        const from = active.has(tx.accountId) || !!tx.isVirtual;
        const to = tx.type === 'transferencia' && !!tx.targetAccountId && active.has(tx.targetAccountId);
        if (tx.isAdjustment) { adjustment += cashDelta(tx, active); continue; }
        if (tx.type === 'receita') { if (from || (to && !from)) income += tx.amount; continue; }
        if (tx.type === 'despesa' && from) {
          if (tx.isVirtual || (tx.recurrence && tx.recurrence !== 'unica')) fixed += tx.amount;
          else variable += tx.amount;
        } else if (tx.type === 'transferencia') {
          if (from && !to) fixed += tx.amount;
          else if (to && !from) income += tx.amount;
        }
      }
      const past = date < today;
      const dailyPlan = budget > 0 ? Math.max(0, budget - fixedExpense - variableSpent) / (daysInMonth(year, month) - day + 1) : 0;
      const planApplied = past ? 0 : Math.max(0, dailyPlan - variable);
      runningBalance += income - fixed - variable + adjustment - planApplied;
      if (past) variableSpent += variable;
      else variableSpent += Math.max(dailyPlan, variable);
      result[key].push({ day, weekDay: WEEK_DAYS[date.getDay()], income, expense: fixed + variable, variableExpense: variable, dailyPlan, balance: runningBalance, isPast: past, isToday: dayKey(date) === dayKey(today), fullDate: date.toISOString(), transactions: visibleRows });
    }
  }
  return result;
}
