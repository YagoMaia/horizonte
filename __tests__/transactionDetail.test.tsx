import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import Screen from '../app/transaction/[id]';
let mockStore: any;
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: 'uuid-with-hyphens' }) }));
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ colors: require('../constants/theme').Colors.light }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const tx = { id: 'uuid-with-hyphens', accountId: 'a', targetAccountId: 'b', amount: 10, type: 'transferencia', recurrence: 'unica', date: '2026-10-20', paid: true, tag: 'Reserva' };
beforeEach(() => {
  jest.clearAllMocks(); mockRouter.canGoBack.mockReturnValue(true);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockStore = { transactions: [{ ...tx }], accounts: [{ id: 'a', name: 'Banco A' }, { id: 'b', name: 'Banco B' }], projects: [], goals: [], loading: false, deleteTransaction: jest.fn(async () => {}) };
});
function confirmDelete() { const calls = (Alert.alert as jest.Mock).mock.calls; return calls[calls.length - 1][2].find((b: any) => b.text === 'Excluir').onPress(); }
it('aguarda carregamento antes de redirecionar e abre dados carregados', () => {
  mockStore.loading = true; mockStore.transactions = [];
  const ui = render(<Screen />); expect(mockRouter.back).not.toHaveBeenCalled();
  mockStore.loading = false; mockStore.transactions = [tx]; ui.rerender(<Screen />);
  expect(ui.getByText('Banco B')).toBeTruthy(); expect(ui.getByText('Reserva')).toBeTruthy();
  expect(mockRouter.back).not.toHaveBeenCalled();
});
it('volta para inicio quando registro nao existe e nao ha historico', () => {
  mockStore.transactions = []; mockRouter.canGoBack.mockReturnValue(false);
  render(<Screen />); expect(mockRouter.replace).toHaveBeenCalledWith('/');
});
it('UUID nao e recorrencia e edicao encaminha identificador', () => {
  const ui = render(<Screen />);
  fireEvent.press(ui.getByText('Editar'));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/add-transaction', params: { txId: tx.id } });
  fireEvent.press(ui.getByText('Excluir'));
  expect(Alert.alert).toHaveBeenCalledWith('Excluir lançamento', expect.any(String), expect.any(Array));
});
it('bloqueia exclusao duplicada e so sai apos persistir', async () => {
  let finish!: () => void;
  mockStore.deleteTransaction.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const ui = render(<Screen />); fireEvent.press(ui.getByText('Excluir'));
  let pending: Promise<void>;
  act(() => { pending = confirmDelete(); });
  await act(async () => { await confirmDelete(); });
  expect(mockStore.deleteTransaction).toHaveBeenCalledTimes(1); expect(mockRouter.back).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it('mantem tela e permite nova tentativa apos erro', async () => {
  mockStore.deleteTransaction.mockRejectedValueOnce(new Error('Falha ao gravar'));
  const ui = render(<Screen />); fireEvent.press(ui.getByText('Excluir'));
  await act(async () => { await confirmDelete(); });
  expect(mockRouter.back).not.toHaveBeenCalled(); expect(Alert.alert).toHaveBeenLastCalledWith('Aviso', 'Falha ao gravar');
  fireEvent.press(ui.getByText('Excluir')); await act(async () => { await confirmDelete(); });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it('mostra parcela legada e exclui somente a abrangencia escolhida', async () => {
  mockStore.transactions = [{ ...tx, groupId: 'family', groupIndex: 2, totalInstallments: 12 }];
  const ui = render(<Screen />); expect(ui.getByText('3 de 12')).toBeTruthy();
  fireEvent.press(ui.getByText('Excluir')); expect(ui.getByText('Exclui apenas o lançamento selecionado.')).toBeTruthy();
  await act(async () => fireEvent.press(ui.getByText('Este e os seguintes')));
  expect(mockStore.deleteTransaction).toHaveBeenCalledWith(tx.id, 'future');
});
it('protege pagamentos de cartao contra edicao e exclusao', () => {
  mockStore.transactions = [{ ...tx, settledByPaymentId: 'payment' }];
  const ui = render(<Screen />); fireEvent.press(ui.getByText('Editar')); fireEvent.press(ui.getByText('Excluir'));
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockStore.deleteTransaction).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledTimes(2);
});
it('tolera data invalida e conta removida', () => {
  mockStore.transactions = [{ ...tx, date: 'invalid', targetAccountId: 'missing' }];
  const ui = render(<Screen />); expect(ui.getByText('Conta não encontrada')).toBeTruthy();
});
