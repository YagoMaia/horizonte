import { Account, Goal, Transaction } from '@/constants/types';
import { dayKey, financialDate } from './financialDate';
import { getInvoiceForTx } from './utils';
import { buildCardInvoices, invoiceMonth } from './cardInvoices';

export type PaymentStatus = 'realizado' | 'previsto' | 'vencido';
export interface TransactionMeta { day: string; month: string; time: number; status: PaymentStatus; search: string }
export interface ProjectTotals { income: number; spent: number; available: number; realisedIncome: number; realisedSpent: number }
export interface MonthTotals { income: number; expense: number; pendingIncome: number; pendingExpense: number; adjustments: number }
const emptyMonth = (): MonthTotals => ({ income: 0, expense: 0, pendingIncome: 0, pendingExpense: 0, adjustments: 0 });
export const EMPTY_PROJECT: ProjectTotals = { income: 0, spent: 0, available: 0, realisedIncome: 0, realisedSpent: 0 };
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cents = (value: number) => Math.round(value * 100);

/** Uma passagem agrega o histórico; ordenação ocorre uma vez, somente quando os dados mudam. */
export function buildFinancialIndex(accounts: Account[], transactions: Transaction[], goals: Goal[], today = new Date()) {
  const todayKey = dayKey(today);
  const accountById = new Map(accounts.map(a => [a.id, a]));
  const balanceCents = new Map(accounts.map(a => [a.id, 0]));
  const metadata = new Map<string, TransactionMeta>();
  const months = new Map<string, Transaction[]>();
  const summaries = new Map<string, MonthTotals>();
  const realisedFlow = new Map<string, number>();
  const pendingFlow = new Map<string, number>();
  const projects = new Map<string, ProjectTotals>();
  const goalCents = new Map(goals.map(g => [g.id, cents(g.savedAmount || 0)]));
  const cardIndex = buildCardInvoices(accounts, transactions);
  const openInvoiceTotals = new Map<string, number>();
  const cardDebt = new Map<string, number>();
  const openInvoices = new Map(accounts.filter(a => a.type === 'cartao_credito').map(a => [a.id, getInvoiceForTx(todayKey, a).value]));
  const addFlow = (map: Map<string, number>, month: string, value: number) => map.set(month, (map.get(month) || 0) + value);
  const cashAccount = (id?: string) => !!id && accountById.has(id) && accountById.get(id)!.type !== 'cartao_credito';

  for (const tx of transactions) {
    const date = financialDate(tx.date);
    const day = dayKey(date);
    if (!day || !Number.isFinite(tx.amount)) continue;
    const month = day.slice(0, 7);
    const realised = tx.paid && day <= todayKey;
    const status: PaymentStatus = realised ? 'realizado' : !tx.paid && day < todayKey ? 'vencido' : 'previsto';
    metadata.set(tx.id, { day, month, time: date.getTime(), status, search: normalizeSearch(tx.description) });
    const bucket = months.get(month) || [];
    bucket.push(tx);
    months.set(month, bucket);
    const amount = cents(tx.amount);
    const summary = summaries.get(month) || emptyMonth();
    summaries.set(month, summary);
    let cashDelta = 0;
    if (cashAccount(tx.accountId)) {
      const delta = tx.type === 'receita' ? amount : -amount;
      cashDelta += delta;
      if (realised) balanceCents.set(tx.accountId, balanceCents.get(tx.accountId)! + delta);
      if (!tx.isAdjustment && tx.type !== 'transferencia') {
        if (tx.type === 'receita') summary[realised ? 'income' : 'pendingIncome'] += amount;
        else summary[realised ? 'expense' : 'pendingExpense'] += amount;
      }
    }
    if (tx.type === 'transferencia' && cashAccount(tx.targetAccountId)) {
      cashDelta += amount;
      if (realised) balanceCents.set(tx.targetAccountId!, balanceCents.get(tx.targetAccountId!)! + amount);
    }
    if (tx.isAdjustment && realised) summary.adjustments += cashDelta;
    addFlow(realised ? realisedFlow : pendingFlow, month, cashDelta);

    const card = accountById.get(tx.accountId);
    if (card?.type === 'cartao_credito' && tx.paymentMethod === 'credito') {
      const month = invoiceMonth(tx, card);
      const invoice = cardIndex.invoices.get(card.id + ':' + month)!;
      metadata.get(tx.id)!.status = tx.paid || invoice.pending === 0 ? 'realizado' : invoice.due < todayKey ? 'vencido' : 'previsto';
      const value = tx.type === 'receita' ? -amount : amount;
      if (day <= todayKey && Number(month.replace('-', '')) === openInvoices.get(card.id)) openInvoiceTotals.set(card.id, (openInvoiceTotals.get(card.id) || 0) + value);
    }
    if (tx.projectId) {
      const stats = projects.get(tx.projectId) || { ...EMPTY_PROJECT };
      if (tx.type === 'receita') { stats.income += amount; if (realised) stats.realisedIncome += amount; }
      else { stats.spent += amount; if (realised) stats.realisedSpent += amount; }
      projects.set(tx.projectId, stats);
    }
    if (realised && tx.goalIds?.length && amount > 0) {
      const ids = [...new Set(tx.goalIds)].filter(id => goalCents.has(id)).sort();
      const share = Math.floor(amount / ids.length);
      ids.forEach((id, index) => goalCents.set(id, goalCents.get(id)! + share + (index < amount % ids.length ? 1 : 0)));
    }
  }
  for (const invoice of cardIndex.invoices.values()) {
    const pending = Math.max(0, invoice.pending);
    const month = invoice.due.slice(0, 7);
    const summary = summaries.get(month) || emptyMonth();
    summary.pendingExpense += pending;
    summaries.set(month, summary);
    addFlow(pendingFlow, month, -pending);
    cardDebt.set(invoice.cardId, (cardDebt.get(invoice.cardId) || 0) + pending);
  }
  for (const bucket of months.values()) bucket.sort((a, b) => metadata.get(b.id)!.time - metadata.get(a.id)!.time || a.id.localeCompare(b.id));
  for (const stats of projects.values()) {
    stats.income /= 100; stats.spent /= 100; stats.realisedIncome /= 100; stats.realisedSpent /= 100;
    stats.available = stats.income - stats.spent;
  }
  for (const summary of summaries.values()) for (const key of Object.keys(summary) as (keyof MonthTotals)[]) summary[key] /= 100;
  const balances = new Map([...balanceCents].map(([id, value]) => [id, value / 100]));
  const totalBalance = [...balanceCents.values()].reduce((sum, value) => sum + value, 0) / 100;
  return { cardIndex, todayKey, accountById, balances, totalBalance, metadata, months, summaries, projects,
    goalAmounts: new Map([...goalCents].map(([id, value]) => [id, value / 100])),
    openInvoiceTotals: new Map([...openInvoiceTotals].map(([id, value]) => [id, value / 100])),
    cardDebt: new Map([...cardDebt].map(([id, value]) => [id, value / 100])),
    summary: (month: string) => summaries.get(month) || emptyMonth(),
    closingBalance: (month: string) => [...realisedFlow].reduce((sum, [key, value]) => key <= month ? sum + value : sum, 0) / 100,
    projectedBalance: (month: string) => totalBalance + [...pendingFlow].reduce((sum, [key, value]) => key <= month ? sum + value : sum, 0) / 100,
  };
}
export type FinancialIndex = ReturnType<typeof buildFinancialIndex>;

export function calculateAccountBalances(accounts: Account[], transactions: Transaction[], today = new Date()) {
  const cutoff = dayKey(today);
  const balances = new Map(accounts.filter(a => a.type !== 'cartao_credito').map(a => [a.id, 0]));
  for (const tx of transactions) {
    const day = dayKey(tx.date);
    if (!tx.paid || !day || day > cutoff || !Number.isFinite(tx.amount)) continue;
    const amount = cents(tx.amount);
    if (balances.has(tx.accountId)) balances.set(tx.accountId, balances.get(tx.accountId)! + (tx.type === 'receita' ? amount : -amount));
    if (tx.type === 'transferencia' && balances.has(tx.targetAccountId!)) balances.set(tx.targetAccountId!, balances.get(tx.targetAccountId!)! + amount);
  }
  return accounts.map(a => ({ ...a, balance: (balances.get(a.id) || 0) / 100 }));
}

export interface SaldosFilters { type: 'todas' | Transaction['type']; accountId: string; status: 'todos' | PaymentStatus; query: string; includeAdjustments: boolean }
export const DEFAULT_SALDOS_FILTERS: SaldosFilters = { type: 'todas', accountId: 'todas', status: 'todos', query: '', includeAdjustments: false };
export function filterMonth(index: FinancialIndex, month: string, filters: SaldosFilters) {
  const query = normalizeSearch(filters.query.trim());
  return (index.months.get(month) || []).filter(tx => {
    const meta = index.metadata.get(tx.id)!;
    return (filters.includeAdjustments || !tx.isAdjustment) && (filters.type === 'todas' || tx.type === filters.type)
      && (filters.accountId === 'todas' || tx.accountId === filters.accountId || tx.targetAccountId === filters.accountId)
      && (filters.status === 'todos' || meta.status === filters.status) && (!query || meta.search.includes(query));
  });
}
