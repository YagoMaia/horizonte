import { parsePurchase } from '../lib/purchaseImport';
const event = (text: string) => ({ id: 'id', packageName: 'bank', title: 'Banco', text, timestamp: new Date(2026, 0, 1).getTime() });
it('reconhece crédito e débito explicitamente e valores brasileiros', () => {
  expect(parsePurchase(event('Compra aprovada no crédito de R$ 1.234,56 em Mercado'))).toMatchObject({ kind: 'credito', amount: 1234.56, uncertain: false });
  expect(parsePurchase(event('Compra realizada no débito: R$ 45,90'))).toMatchObject({ kind: 'debito', amount: 45.9, uncertain: false });
});
it.each(['Compra negada no crédito R$ 10,00', 'Compra cancelada R$ 10,00', 'Estorno da compra R$ 10,00', 'Compra não autorizada R$ 10,00', 'Pagamento da fatura R$ 500,00', 'Seu código é 123456'])('ignora alerta que não é compra efetivada: %s', text => {
  expect(parsePurchase(event(text))).toBeNull();
});
it.each(['Compra aprovada R$ 10,00', 'Compra aprovada no crédito em 3x R$ 10,00', 'Compra aprovada crédito R$ 10,00 e limite R$ 500,00', 'Compra crédito R$ 10,00', 'Compra aprovada crédito e débito R$ 10,00', 'Compra aprovada no crédito sem valor'])('leva ambiguidade e parcelas para revisão: %s', text => {
  expect(parsePurchase(event(text))?.uncertain).toBe(true);
});
