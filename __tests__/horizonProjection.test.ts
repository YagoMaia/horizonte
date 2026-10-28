import { Account, Transaction } from '../constants/types';
import { buildHorizonProjection, parseBudgetMoney } from '../lib/horizonProjection';

const bank: Account = { id: 'bank', name: 'Conta', balance: 1000, type: 'corrente', color: '#000', icon: 'wallet' };
const card: Account = { id: 'card', name: 'Cartão', balance: 0, type: 'cartao_credito', color: '#000', icon: 'card', closingDay: 25, dueDay: 5 };
const purchase = (patch: Partial<Transaction> = {}): Transaction => ({ id: 'purchase', description: 'Compra', amount: 200, accountId: 'card', type: 'despesa', paymentMethod: 'credito', date: '2026-09-10', recurrence: 'unica', paid: false, ...patch });
const project = (today: Date, accounts = [bank, card], transactions: Transaction[] = [purchase()], ids = ['bank'], includeCardInvoices = true) => buildHorizonProjection({ accounts, transactions, activeAccountIds: ids, year: today.getFullYear(), month: today.getMonth(), today, getBudget: () => 0, includeCardInvoices });

it('lança a fatura no vencimento do mês atual, e não no primeiro dia', () => {
  const days = project(new Date(2026, 9, 1, 12))['2026-9'];
  expect(days[3].balance).toBe(1000);
  expect(days[4].balance).toBe(800);
  expect(days[4].transactions[0].isVirtual).toBe(true);
});

it('move fatura vencida para hoje sem retroagir o saldo atual', () => {
  const days = project(new Date(2026, 9, 17, 12))['2026-9'];
  expect(days[15].balance).toBe(1000);
  expect(days[16].balance).toBe(800);
});

it('reserva as faturas futuras no dia 1 sem novo desconto no vencimento', () => {
  const rows = [purchase({ date: '2026-10-10', amount: 200 }), purchase({ id: 'dec', date: '2026-11-10', amount: 300 })];
  const result = project(new Date(2026, 9, 27, 12), [bank, card], rows);
  expect(result['2026-9'][30].balance).toBe(1000);
  expect(result['2026-10'][0].balance).toBe(800);
  expect(result['2026-10'][0].expense).toBe(200);
  expect(result['2026-10'][0].transactions[0].description).toContain('reserva do mês');
  expect(result['2026-10'][4].expense).toBe(0);
  expect(result['2026-10'][29].balance).toBe(800);
  expect(result['2026-11'][0].balance).toBe(500);
  expect(result['2026-11'][4].expense).toBe(0);
});

it('reserva só o restante após antecipação e mantém o cálculo ao abrir mês futuro diretamente', () => {
  const rows = [purchase({ date: '2026-10-10' }), purchase({ id: 'credit', date: '2026-10-15', invoiceMonth: '2026-11', type: 'receita', amount: 50 })];
  const result = buildHorizonProjection({ accounts: [bank, card], transactions: rows, activeAccountIds: ['bank'], year: 2026, month: 10, today: new Date(2026, 9, 27, 12), getBudget: () => 0, includeCardInvoices: true });
  expect(result['2026-10'][0].expense).toBe(150);
  expect(result['2026-10'][0].balance).toBe(850);
});

it('reserva janeiro no primeiro dia inclusive na virada do ano', () => {
  const result = project(new Date(2026, 11, 27, 12), [bank, card], [purchase({ date: '2026-12-10' })]);
  expect(result['2027-0'][0].expense).toBe(200);
  expect(result['2027-0'][4].expense).toBe(0);
});

it('com reserva antecipada desligada mantém as faturas futuras apenas no vencimento', () => {
  const result = buildHorizonProjection({ accounts: [bank, card], transactions: [purchase({ date: '2026-10-10' })], activeAccountIds: ['bank'], year: 2026, month: 10, today: new Date(2026, 9, 27, 12), getBudget: () => 0, includeCardInvoices: true, reserveFutureInvoices: false });
  expect(result['2026-10'][0].balance).toBe(1000);
  expect(result['2026-10'][0].expense).toBe(0);
  expect(result['2026-10'][4].expense).toBe(200);
  expect(result['2026-10'][29].balance).toBe(800);
});

it('respeita a escolha de incluir faturas e a seleção de contas', () => {
  const today = new Date(2026, 9, 1, 12);
  expect(project(today, [bank, card], [purchase()], [], true)['2026-9'][4].balance).toBe(0);
  expect(project(today, [bank, card], [purchase()], ['bank'], false)['2026-9'][4].balance).toBe(1000);
});

it('não duplica uma fatura quitada por lançamento vinculado', () => {
  const settled = purchase({ paid: true });
  const days = project(new Date(2026, 9, 1, 12), [bank, card], [settled])['2026-9'];
  expect(days[4].balance).toBe(1000);
  expect(days[4].transactions).toHaveLength(0);
});

it('aceita orçamento brasileiro e rejeita valores negativos ou parciais', () => {
  expect(parseBudgetMoney('1.234,56')).toBe(1234.56);
  expect(parseBudgetMoney('0,00')).toBe(0);
  expect(() => parseBudgetMoney('-1')).toThrow();
  expect(() => parseBudgetMoney('1,2,3')).toThrow();
});
