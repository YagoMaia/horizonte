import { parseAccountAmount, parseCardDay } from '../lib/accountInput';

describe('account input', () => {
  it('interpreta valor brasileiro sem truncar milhares', () => {
    expect(parseAccountAmount('1.234,56', 'o saldo')).toBe(1234.56);
    expect(parseAccountAmount('-25,40', 'o saldo')).toBe(-25.4);
    expect(parseAccountAmount('', 'o saldo')).toBe(0);
  });

  it('rejeita valores e dias inválidos', () => {
    expect(() => parseAccountAmount('1,234.56', 'o saldo')).toThrow();
    expect(() => parseAccountAmount('-1', 'o limite', false)).toThrow();
    expect(() => parseCardDay('25abc', 'Dia de fechamento')).toThrow();
    expect(() => parseCardDay('32', 'Dia de vencimento')).toThrow();
  });
});

