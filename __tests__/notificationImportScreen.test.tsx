import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import Screen from '../app/notification-import';
let mockImport: any;
jest.mock('../context/PurchaseImportContext', () => ({ usePurchaseImportContext: () => mockImport }));
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => ({ accounts: [{ id: 'card', name: 'Cartão A', type: 'cartao_credito' }, { id: 'cash', name: 'Conta A', type: 'corrente' }] }) }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ colors: require('../constants/theme').Colors.light }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('../services/purchaseCapture', () => ({ captureNative: () => null }));
beforeEach(() => { mockImport = { state: { banks: [{ packageName: 'bank', name: 'Banco', enabled: true, credito: { mode: 'off', accountId: '' }, debito: { mode: 'off', accountId: '' } }], pending: [] }, error: '', access: false, ready: true, supported: true, dropped: 0, scan: jest.fn(), saveBanks: jest.fn(async () => {}) }; });
it('salva escolhas independentes por modalidade e destinos compatíveis', async () => {
  const ui = render(<Screen />);
  fireEvent.press(ui.getByText('Banco — ativo'));
  fireEvent.press(ui.getByText('credito: Automático'));
  fireEvent.press(ui.getByText('Cartão A'));
  fireEvent.press(ui.getByText('debito: Revisar antes'));
  fireEvent.press(ui.getByText('Conta A'));
  await act(async () => fireEvent.press(ui.getByText('Salvar regras')));
  expect(mockImport.saveBanks).toHaveBeenCalledWith([expect.objectContaining({ credito: { mode: 'auto', accountId: 'card' }, debito: { mode: 'review', accountId: 'cash' } })]);
});
it('informa claramente quando a instalação não possui o módulo Android', () => {
  mockImport.supported = false;
  const ui = render(<Screen />);
  expect(ui.getByText(/Disponível no novo APK Android/)).toBeTruthy();
  expect(ui.queryByText('Autorizar acesso no Android')).toBeNull();
});

it('associa vários finais e pede autorização separada para destino sem identificação', async () => {
  const ui = render(<Screen />); fireEvent.press(ui.getByText('Banco — ativo'));
  fireEvent.changeText(ui.getByLabelText('Finais credito Cartão A'), '1234,');
  expect(ui.getByLabelText('Finais credito Cartão A').props.value).toBe('1234,');
  fireEvent.changeText(ui.getByLabelText('Finais credito Cartão A'), '1234,5678');
  fireEvent.press(ui.getByText('Cartão A'));
  fireEvent(ui.getByLabelText('Permitir destino sem final credito'), 'valueChange', true);
  await act(async () => fireEvent.press(ui.getByText('Salvar regras')));
  expect(mockImport.saveBanks).toHaveBeenCalledWith([expect.objectContaining({ credito: expect.objectContaining({ allowWithoutIdentifier: true, destinations: [{ accountId: 'card', lastFour: '1234' }, { accountId: 'card', lastFour: '5678' }] }) })]);
});

it('pagina pendências e confirma parcelas com base de valor explícita', async () => {
  mockImport.review = jest.fn(async () => {});
  mockImport.state.pending = Array.from({ length: 45 }, (_, i) => ({ id: String(i), packageName: 'bank', title: `Compra ${i}`, text: 'Compra parcelada', timestamp: Date.now(), amount: 10, description: 'Loja', uncertain: true, installments: 3, kind: 'credito' }));
  const ui = render(<Screen />);
  expect(ui.queryByText(/— Compra 20 —/)).toBeNull();
  fireEvent.press(ui.getByText('Próximas pendências'));
  fireEvent.press(ui.getByText(/— Compra 20 —/));
  fireEvent.press(ui.getByText('Cartão A'));
  fireEvent.press(ui.getByText('Valor de cada parcela'));
  expect(ui.getByText(/Total a registrar:.*30,00.*3 parcelas/)).toBeTruthy();
  await act(async () => fireEvent.press(ui.getByText('Confirmar lançamento')));
  expect(mockImport.review).toHaveBeenCalledWith(expect.objectContaining({ id: '20' }), 'credito', 'card', 10, 'Loja', expect.objectContaining({ installments: 3, amountBasis: 'installment' }));
});
