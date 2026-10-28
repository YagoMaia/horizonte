import { parseTransactionDate } from '../lib/transactionInput';

it('preserva o dia escolhido e rejeita datas impossíveis', () => {
  expect(parseTransactionDate('28/10/2026')).toBe('2026-10-28');
  expect(parseTransactionDate('29/02/2028')).toBe('2028-02-29');
  for (const value of ['31/02/2026', '29/02/2026', '10/13/2026', '', '01/01/0099']) {
    expect(() => parseTransactionDate(value)).toThrow();
  }
});
