import { destinationFor, parsePurchase, validatePurchaseBanks } from '../lib/purchaseImport';
const event = (text: string) => ({ id: 'id', packageName: 'bank', title: 'Banco', text, timestamp: new Date(2026, 0, 1).getTime() });
it('reconhece crédito e débito explicitamente e valores brasileiros', () => {
  expect(parsePurchase(event('Compra aprovada no crédito de R$ 1.234,56 em Mercado'))).toMatchObject({ kind: 'credito', amount: 1234.56, uncertain: false });
  expect(parsePurchase(event('Compra realizada no débito: R$ 45,90'))).toMatchObject({ kind: 'debito', amount: 45.9, uncertain: false });
});
it('mensagem de pagamento no cartão fica para revisão e não inclui boletos, PIX ou faturas', () => {
  expect(parsePurchase(event('Pagamento aprovado no crédito R$ 45,90'))).toMatchObject({ amount: 45.9, uncertain: true });
  for (const text of ['Pagamento aprovado da fatura no crédito R$ 45,90', 'Pagamento realizado via PIX no débito R$ 45,90', 'Pagamento recebido no crédito R$ 45,90']) expect(parsePurchase(event(text))).toBeNull();
});
it('extrai finais e parcelas, mantendo ambiguidade de valores para revisão', () => {
  expect(parsePurchase(event('Compra aprovada no crédito R$ 40,00 cartão final 1234 em 3x'))).toMatchObject({ lastFour: '1234', installments: 3, uncertain: true });
  expect(parsePurchase(event('Compra aprovada no crédito R$ 40,00 cartão ****5678'))).toMatchObject({ lastFour: '5678' });
  expect(parsePurchase(event('Compra aprovada no crédito R$ 40,00 limite R$ 40,00'))).toMatchObject({ amount: undefined, uncertain: true });
});
it('sem final não automatiza sem autorização explícita e final divergente nunca usa padrão', () => {
  const candidate = parsePurchase(event('Compra aprovada no crédito R$ 40,00'))!;
  const accounts: any = [{ id: 'card', type: 'cartao_credito' }];
  const rule: any = { mode: 'auto', accountId: 'card' };
  expect(destinationFor(candidate, rule, accounts)).toBeUndefined();
  expect(destinationFor(candidate, { ...rule, allowWithoutIdentifier: true }, accounts)?.id).toBe('card');
  expect(destinationFor({ ...candidate, lastFour: '9999' }, { ...rule, allowWithoutIdentifier: true }, accounts)).toBeUndefined();
});
it('rejeita associação ambígua do mesmo final e entradas malformadas', () => {
  expect(() => validatePurchaseBanks([{ packageName: 'bank', name: 'Banco', enabled: true, credito: { mode: 'auto', accountId: '', destinations: [{ accountId: 'a', lastFour: '1234' }, { accountId: 'b', lastFour: '1234' }] }, debito: { mode: 'off', accountId: '' } }])).toThrow('sem repetir');
  expect(parsePurchase({ ...event('Compra'), text: null } as any)).toBeNull();
});
it.each(['Compra negada no crédito R$ 10,00', 'Compra cancelada R$ 10,00', 'Estorno da compra R$ 10,00', 'Compra não autorizada R$ 10,00', 'Pagamento da fatura R$ 500,00', 'Seu código é 123456'])('ignora alerta que não é compra efetivada: %s', text => {
  expect(parsePurchase(event(text))).toBeNull();
});
it.each(['Compra aprovada R$ 10,00', 'Compra aprovada no crédito em 3x R$ 10,00', 'Compra aprovada crédito R$ 10,00 e limite R$ 500,00', 'Compra crédito R$ 10,00', 'Compra aprovada crédito e débito R$ 10,00', 'Compra aprovada no crédito sem valor'])('leva ambiguidade e parcelas para revisão: %s', text => {
  expect(parsePurchase(event(text))?.uncertain).toBe(true);
});
