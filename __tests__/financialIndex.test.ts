import { buildFinancialIndex, calculateAccountBalances, DEFAULT_SALDOS_FILTERS, filterMonth } from '../lib/financialIndex';
import { dayKey, financialDate, goalForecast } from '../lib/financialDate';
import { Account, Transaction } from '../constants/types';
const bank: Account = { id: 'bank', name: 'Banco', type: 'corrente', balance: 0, color: '#000', icon: 'wallet' };
const card: Account = { ...bank, id: 'card', type: 'cartao_credito', closingDay: 25, dueDay: 5 };
const today = new Date(2026, 9, 17, 12);
const tx = (values: Partial<Transaction>): Transaction => ({ id: 'tx', description: 'Salário', amount: 100, accountId: 'bank', date: '2026-10-10', type: 'receita', paid: true, recurrence: 'unica', ...values });

it('acumula pendências de todos os meses até o período selecionado', () => {
  const index = buildFinancialIndex([bank], [tx({ id: 'initial', amount: 1000, isAdjustment: true }), tx({ id: 'oct', amount: 500, paid: false, type: 'despesa' }), tx({ id: 'nov', amount: 300, date: '2026-11-10', paid: false, type: 'despesa' }), tx({ id: 'dec', amount: 200, date: '2026-12-10', paid: false })], [], today);
  expect(index.totalBalance).toBe(1000);
  expect(index.projectedBalance('2026-12')).toBe(400);
  expect(index.summary('2026-10')).toEqual({ income: 0, expense: 0, pendingIncome: 0, pendingExpense: 500, adjustments: 1000 });
});
it('projeta faturas no vencimento e não duplica compras após pagar a fatura', () => {
  const initial = tx({ id: 'initial', amount: 1000 });
  const purchase = tx({ id: 'purchase', accountId: 'card', type: 'despesa', paymentMethod: 'credito', amount: 400, paid: false });
  const index = buildFinancialIndex([bank, card], [initial, purchase], [], today);
  expect(index.projectedBalance('2026-10')).toBe(1000);
  expect(index.projectedBalance('2026-11')).toBe(600);
  const paid = buildFinancialIndex([bank, card], [initial, { ...purchase, paid: true }, tx({ id: 'payment', type: 'despesa', amount: 400 })], [], today);
  expect(paid.projectedBalance('2026-11')).toBe(600);
  expect(paid.cardDebt.get('card')).toBe(0);
});
it('mantém transferências internas neutras e saldo histórico apenas realizado', () => {
  const entries = [tx({ amount: 1000, date: '2026-09-10' }), tx({ id: 'transfer', type: 'transferencia', targetAccountId: 'savings', amount: 200 }), tx({ id: 'pending', date: '2026-09-20', paid: false })];
  const index = buildFinancialIndex([bank, { ...bank, id: 'savings' }], entries, [], today);
  expect(index.totalBalance).toBe(1000);
  expect(index.closingBalance('2026-09')).toBe(1000);
  expect(index.balances.get('bank')).toBe(800);
  expect(index.balances.get('savings')).toBe(200);
  expect(calculateAccountBalances([bank, { ...bank, id: 'savings' }], entries, today).map(a => a.balance)).toEqual([800, 200]);
});
it('filtra mês, status, conta destinatária e busca sem acentos', () => {
  const index = buildFinancialIndex([bank], [tx({}), tx({ id: 'late', paid: false, type: 'transferencia', targetAccountId: 'other' }), tx({ id: 'future', date: '2027-01-10' })], [], today);
  expect(filterMonth(index, '2026-10', { ...DEFAULT_SALDOS_FILTERS, accountId: 'other', status: 'vencido', query: 'salario' }).map(t => t.id)).toEqual(['late']);
});
it('datas sem hora conservam o dia local e instantes usam o horário local', () => {
  expect(dayKey('2026-11-01')).toBe('2026-11-01');
  const late = new Date(2026, 9, 17, 22);
  const entry = tx({ date: late.toISOString() });
  const index = buildFinancialIndex([bank], [entry], [], today);
  expect(index.totalBalance).toBe(100);
  expect(calculateAccountBalances([bank], [entry], today)[0].balance).toBe(100);
  expect(financialDate('2026-11-01').getDate()).toBe(1);
});
it('previsão da meta trata aporte zero e fim do mês', () => {
  expect(goalForecast(100, 0, today)).toBe('Sem previsão');
  expect(goalForecast(0, 0, today)).toBe('Concluída');
  expect(goalForecast(100, 100, new Date(2026, 9, 31))).toMatch(/nov/);
});
it('separa projetos realizados e previstos sem varrer o histórico a cada consulta', () => {
  const index = buildFinancialIndex([bank], [tx({ projectId: 'p', amount: 50 }), tx({ id: 'planned', projectId: 'p', type: 'despesa', amount: 200, paid: false })], [], today);
  expect(index.projects.get('p')).toEqual({ income: 50, spent: 200, available: -150, realisedIncome: 50, realisedSpent: 0 });
});
