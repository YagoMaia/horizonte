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
