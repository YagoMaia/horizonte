import React from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import Screen from '../app/add-transaction';
let mockStore: any;
let mockParams: any = {};
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }), useLocalSearchParams: () => mockParams }));
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ colors: require('../constants/theme').Colors.light }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const bank = { id: 'a', name: 'Banco A', type: 'corrente', color: '#000' };
beforeEach(() => {
  jest.clearAllMocks(); mockParams = {};
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockStore = { accounts: [bank, { ...bank, id: 'b', name: 'Banco B' }], transactions: [], tags: [], projects: [], goals: [], loading: false, addTransaction: jest.fn(async () => {}), updateTransaction: jest.fn(async () => {}) };
});
it('rejeita valor vazio e zero', () => {
  const ui = render(<Screen />);
  fireEvent.press(ui.getByText('Salvar'));
  fireEvent.changeText(ui.getByPlaceholderText('0,00'), '0');
  fireEvent.press(ui.getByText('Salvar'));
  expect(mockStore.addTransaction).not.toHaveBeenCalled(); expect(Alert.alert).toHaveBeenCalledTimes(2);
});
it('aguarda persistencia, evita duplo toque e permite tentar apos falha', async () => {
  let reject!: (e: Error) => void;
  mockStore.addTransaction.mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
  const ui = render(<Screen />);
  fireEvent.changeText(ui.getByPlaceholderText('0,00'), '1000');
  fireEvent.press(ui.getByText('Salvar')); fireEvent.press(ui.getByText('Salvando...'));
  expect(mockBack).not.toHaveBeenCalled(); expect(mockStore.addTransaction).toHaveBeenCalledTimes(1);
  expect(ui.getByLabelText('Fechar lançamento')).toBeDisabled();
  fireEvent.press(ui.getByLabelText('Fechar lançamento'));
  expect(mockBack).not.toHaveBeenCalled();
  await act(async () => reject(new Error('Falha de armazenamento')));
  expect(Alert.alert).toHaveBeenCalled(); expect(mockBack).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(ui.getByText('Salvar')));
  expect(mockBack).toHaveBeenCalledTimes(1);
});

it('expõe a quantidade da recorrência e salva o número escolhido', async () => {
  const ui = render(<Screen />);
  fireEvent.changeText(ui.getByLabelText('Valor do lançamento'), '1000');
  fireEvent.press(ui.getByLabelText('Repetição: Diária'));
  expect(ui.getByLabelText('Quantidade de repetições').props.value).toBe('24');
  expect(ui.getByText(/Serão criados 24 lançamentos/)).toBeTruthy();
  fireEvent.changeText(ui.getByLabelText('Quantidade de repetições'), '30');
  await act(async () => fireEvent.press(ui.getByLabelText('Salvar lançamento')));
  expect(mockStore.addTransaction).toHaveBeenCalledWith(expect.objectContaining({ recurrence: 'diaria', calculatedRecurrenceCount: 30 }));
});

it.each(['0', '1001', '1.5', 'abc'])('rejeita quantidade de recorrências inválida: %s', value => {
  const ui = render(<Screen />);
  fireEvent.changeText(ui.getByLabelText('Valor do lançamento'), '1000');
  fireEvent.press(ui.getByLabelText('Repetição: Diária'));
  fireEvent.changeText(ui.getByLabelText('Quantidade de repetições'), value);
  fireEvent.press(ui.getByLabelText('Salvar lançamento'));
  expect(mockStore.addTransaction).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalled();
});

it('identifica campos, seleção e calendário e adapta o formulário ao teclado Android', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const ui = render(<Screen />);
  expect(ui.getByLabelText('Conta de origem: Banco A').props.accessibilityState).toMatchObject({ selected: true });
  expect(ui.getByLabelText('Lançamento pago ou recebido')).toBeTruthy();
  expect(ui.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('height');
  fireEvent.press(ui.getByLabelText('Data do lançamento'));
  expect(ui.getByLabelText('Mês anterior do calendário')).toBeTruthy();
  expect(ui.getByLabelText('Escolher mês e ano')).toBeTruthy();
  expect(ui.UNSAFE_getAllByType(ScrollView).length).toBeGreaterThan(1);
  ui.unmount();
  platform.restore();
});
it('invalida destino quando ele passa a ser origem', () => {
  mockParams = { type: 'transferencia' };
  const ui = render(<Screen />);
  fireEvent.changeText(ui.getByPlaceholderText('0,00'), '1000');
  fireEvent.press(ui.getAllByText('Banco B')[1]); fireEvent.press(ui.getAllByText('Banco B')[0]);
  fireEvent.press(ui.getByText('Salvar'));
  expect(mockStore.addTransaction).not.toHaveBeenCalled();
});
it('preserva destino e data da ocorrencia ao editar transferencia recorrente', async () => {
  mockParams = { txId: 'series-2' };
  mockStore.transactions = [{ id: 'series-2', groupId: 'series', type: 'transferencia', accountId: 'a', targetAccountId: 'b', amount: 10, description: '', recurrence: 'mensal', recurrenceStartDate: '2026-01-10', date: '2026-03-10', paid: false }];
  const ui = render(<Screen />);
  fireEvent.press(ui.getByText('Salvar'));
  await act(async () => fireEvent.press(ui.getByText('Somente este')));
  expect(mockStore.updateTransaction).toHaveBeenCalledWith(expect.objectContaining({ targetAccountId: 'b', date: expect.stringContaining('2026-03-10') }), 'single');
});
