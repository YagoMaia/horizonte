import { Account, Transaction } from '../constants/types';
import { buildTransactionsCsv, csvCell } from '../lib/csvExport';

const account: Account = { id: 'bank', name: 'Conta; principal', balance: 0, type: 'corrente', color: '#000', icon: 'wallet' };
const tx = (patch: Partial<Transaction> = {}): Transaction => ({ id: 'tx', description: 'Mercado', amount: 12.5, accountId: 'bank', type: 'despesa', date: '2026-11-01', paid: true, recurrence: 'unica', ...patch });

it('protege separadores, aspas e fórmulas em células CSV', () => {
  expect(csvCell('a;"b\nc')).toBe('"a;""b\nc"');
  expect(csvCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
});

it('preserva a data financeira e exporta transferências corretamente', () => {
  const csv = buildTransactionsCsv([tx({ type: 'transferencia', description: '+Transferência' })], [account]);
  expect(csv).toContain('"01/11/2026"');
  expect(csv).toContain('"Transferência"');
  expect(csv).toContain('"\'+Transferência"');
  expect(csv).toContain('"Conta; principal"');
});
