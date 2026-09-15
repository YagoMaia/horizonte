import { filterTransactions, SearchFilters } from './searchUtils';
import { Transaction } from '@/constants/types';

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: '1',
  description: 'Supermercado',
  amount: 150,
  type: 'despesa',
  date: '2024-01-15',
  accountId: 'acc1',
  recurrence: 'unica',
  paid: true,
  ...overrides,
});

const defaultFilters: SearchFilters = { type: 'todas', accountId: 'todas' };

describe('filterTransactions', () => {
  it('returns all transactions when search term is empty and no filters', () => {
    const txs = [makeTransaction({ id: '1' }), makeTransaction({ id: '2' })];
    const result = filterTransactions(txs, '', defaultFilters);
    expect(result).toHaveLength(2);
  });

  it('returns all transactions when search term is whitespace only', () => {
    const txs = [makeTransaction({ id: '1' }), makeTransaction({ id: '2' })];
    const result = filterTransactions(txs, '   ', defaultFilters);
    expect(result).toHaveLength(2);
  });

  it('matches description case-insensitively', () => {
    const txs = [
      makeTransaction({ id: '1', description: 'Supermercado Extra' }),
      makeTransaction({ id: '2', description: 'Farmácia' }),
    ];
    const result = filterTransactions(txs, 'supermercado', defaultFilters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches partial description', () => {
    const txs = [
      makeTransaction({ id: '1', description: 'Pagamento de aluguel' }),
      makeTransaction({ id: '2', description: 'Farmácia' }),
    ];
    const result = filterTransactions(txs, 'aluguel', defaultFilters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches formatted currency amount', () => {
    const txs = [
      makeTransaction({ id: '1', amount: 150 }),
      makeTransaction({ id: '2', amount: 200 }),
    ];
    // formatCurrency(150) produces "R$ 150,00" in pt-BR
    const result = filterTransactions(txs, '150', defaultFilters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches description OR amount (not AND)', () => {
    const txs = [
      makeTransaction({ id: '1', description: 'Supermercado', amount: 300 }),
      makeTransaction({ id: '2', description: 'Farmácia', amount: 150 }),
      makeTransaction({ id: '3', description: '150 reais', amount: 50 }),
    ];
    const result = filterTransactions(txs, '150', defaultFilters);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id).sort()).toEqual(['2', '3']);
  });

  it('applies type filter', () => {
    const txs = [
      makeTransaction({ id: '1', type: 'receita', description: 'Salário' }),
      makeTransaction({ id: '2', type: 'despesa', description: 'Salário desconto' }),
    ];
    const result = filterTransactions(txs, 'salário', { type: 'receita', accountId: 'todas' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('applies account filter', () => {
    const txs = [
      makeTransaction({ id: '1', accountId: 'acc1', description: 'Compra' }),
      makeTransaction({ id: '2', accountId: 'acc2', description: 'Compra online' }),
    ];
    const result = filterTransactions(txs, 'compra', { type: 'todas', accountId: 'acc1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('type "todas" means no type filter', () => {
    const txs = [
      makeTransaction({ id: '1', type: 'receita' }),
      makeTransaction({ id: '2', type: 'despesa' }),
      makeTransaction({ id: '3', type: 'transferencia' }),
    ];
    const result = filterTransactions(txs, '', { type: 'todas', accountId: 'todas' });
    expect(result).toHaveLength(3);
  });

  it('sorts results by date descending', () => {
    const txs = [
      makeTransaction({ id: '1', date: '2024-01-10' }),
      makeTransaction({ id: '2', date: '2024-03-15' }),
      makeTransaction({ id: '3', date: '2024-02-20' }),
    ];
    const result = filterTransactions(txs, '', defaultFilters);
    expect(result.map((t) => t.id)).toEqual(['2', '3', '1']);
  });

  it('guards against null/undefined descriptions', () => {
    const txs = [
      makeTransaction({ id: '1', description: null as unknown as string }),
      makeTransaction({ id: '2', description: undefined as unknown as string }),
      makeTransaction({ id: '3', description: 'Valid' }),
    ];
    // Should not throw
    const result = filterTransactions(txs, 'valid', defaultFilters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('trims search term before matching', () => {
    const txs = [makeTransaction({ id: '1', description: 'Supermercado' })];
    const result = filterTransactions(txs, '  supermercado  ', defaultFilters);
    expect(result).toHaveLength(1);
  });

  it('searches across all months (cross-month scope)', () => {
    const txs = [
      makeTransaction({ id: '1', date: '2024-01-15', description: 'Aluguel' }),
      makeTransaction({ id: '2', date: '2024-06-15', description: 'Aluguel' }),
      makeTransaction({ id: '3', date: '2023-11-15', description: 'Aluguel' }),
    ];
    const result = filterTransactions(txs, 'aluguel', defaultFilters);
    expect(result).toHaveLength(3);
  });

  it('limits results to the selected month when monthPrefix is provided', () => {
    const txs = [
      makeTransaction({ id: '1', date: '2024-01-15', description: 'Aluguel' }),
      makeTransaction({ id: '2', date: '2024-02-15', description: 'Aluguel' }),
    ];
    const result = filterTransactions(txs, 'aluguel', { ...defaultFilters, monthPrefix: '2024-02' });
    expect(result.map((tx) => tx.id)).toEqual(['2']);
  });

  it('applies debit and credit payment filters', () => {
    const txs = [
      makeTransaction({ id: '1', paymentMethod: 'debito' }),
      makeTransaction({ id: '2', paymentMethod: 'credito' }),
      makeTransaction({ id: '3', paymentMethod: undefined }),
    ];
    expect(filterTransactions(txs, '', { ...defaultFilters, paymentMethod: 'debito' }).map(tx => tx.id).sort()).toEqual(['1', '3']);
    expect(filterTransactions(txs, '', { ...defaultFilters, paymentMethod: 'credito' }).map(tx => tx.id)).toEqual(['2']);
  });

  it('matches an account used as transfer destination', () => {
    const txs = [makeTransaction({ id: '1', accountId: 'acc1', targetAccountId: 'acc2', type: 'transferencia' })];
    const result = filterTransactions(txs, '', { type: 'todas', accountId: 'acc2' });
    expect(result.map(tx => tx.id)).toEqual(['1']);
  });
});
