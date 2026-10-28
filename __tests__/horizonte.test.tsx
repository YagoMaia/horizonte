import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HorizonteScreen } from '../components/screens/HorizonteScreen';
import { Account, Transaction } from '../constants/types';
import { FlatList, ScrollView } from 'react-native';
import { formatCurrency } from '../lib/utils';

let mockStore: any;
let mockToday = '2026-10-01';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ colors: require('../constants/theme').Colors.light }) }));
jest.mock('../hooks/useToday', () => ({ useToday: () => mockToday }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: any) => require('react').createElement(require('react-native').Text, null, name) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const bank: Account = { id: 'bank', name: 'Conta', balance: 1000, type: 'corrente', color: '#000', icon: 'wallet' };
const card: Account = { id: 'card', name: 'Cartão', balance: 0, type: 'cartao_credito', color: '#000', icon: 'card', closingDay: 25, dueDay: 5 };
const tx: Transaction = { id: 'purchase', description: 'Compra', amount: 200, accountId: 'card', type: 'despesa', paymentMethod: 'credito', date: '2026-09-10', recurrence: 'unica', paid: false };

beforeEach(async () => {
  mockToday = '2026-10-01';
  await AsyncStorage.clear();
  mockStore = { accounts: [bank, card], transactions: [tx], getEffectiveBudget: jest.fn(() => 0), saveMonthlyBudget: jest.fn().mockResolvedValue(undefined) };
});

async function screen() {
  const result = render(<HorizonteScreen />);
  await act(async () => { await Promise.resolve(); });
  return result;
}

it('mostra a fatura no vencimento do mês atual', async () => {
  const ui = await screen();
  fireEvent.press(ui.getByLabelText(/5 de Outubro/));
  expect(ui.getByText('Fatura de cartão')).toBeTruthy();
});

it('mostra valores sem botão de ocultação e permite escolher mês diretamente', async () => {
  const ui = await screen();
  expect(ui.queryByText('••••')).toBeNull();
  expect(ui.queryByLabelText('Ocultar valores')).toBeNull();
  expect(ui.queryByLabelText('Mostrar valores')).toBeNull();
  fireEvent.press(ui.getByLabelText('Escolher mês da projeção'));
  fireEvent.changeText(ui.getByLabelText('Mês da projeção'), '02/2027');
  fireEvent.press(ui.getByText('Consultar'));
  expect(ui.getByText('Fevereiro 2027')).toBeTruthy();
});

it('salva orçamento brasileiro e permite excluir faturas conscientemente', async () => {
  const ui = await screen();
  fireEvent.press(ui.getByLabelText('Configurar planejamento'));
  fireEvent.changeText(ui.getByLabelText('Orçamento mensal'), '1.234,56');
  fireEvent(ui.getByLabelText('Incluir faturas de cartões'), 'valueChange', false);
  await act(async () => { fireEvent.press(ui.getByText('Salvar planejamento')); });
  expect(mockStore.saveMonthlyBudget).toHaveBeenCalledWith(2026, 9, 1234.56);
  expect(await AsyncStorage.getItem('@horizonte:include_card_invoices')).toBe('false');
  expect(ui.queryByText('Faturas de cartão estão fora desta projeção.')).toBeNull();
});

it('abre no dia atual e permite voltar a hoje mesmo sem trocar o mês', async () => {
  mockToday = '2026-10-27';
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => undefined);
  const ui = await screen();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 120)); });
  expect(scroll).toHaveBeenCalledWith({ index: 26, animated: false });
  scroll.mockClear();
  fireEvent.press(ui.getByText('Mês atual'));
  expect(scroll).toHaveBeenCalledWith({ index: 26, animated: false });
  ui.unmount();
  scroll.mockRestore();
});

it('posiciona hoje também na grade salva e tenta novamente quando a lista não mediu os itens', async () => {
  mockToday = '2026-10-27';
  await AsyncStorage.setItem('@horizonte:view_mode', 'grid');
  const gridScroll = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
  const ui = await screen();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 120)); });
  expect(gridScroll).toHaveBeenCalledWith({ y: 26 * 44, animated: false });
  const listScroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => undefined);
  const offsetScroll = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => undefined);
  fireEvent.press(ui.getByLabelText('Exibir lista diária'));
  fireEvent(ui.UNSAFE_getAllByType(FlatList)[0], 'scrollToIndexFailed', { index: 26, averageItemLength: 90 });
  expect(offsetScroll).toHaveBeenCalledWith({ offset: 26 * 90, animated: false });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
  expect(listScroll).toHaveBeenCalledWith({ index: 26, animated: false });
  ui.unmount();
  gridScroll.mockRestore(); listScroll.mockRestore(); offsetScroll.mockRestore();
});

it('exibe a reserva de fatura nos detalhes do primeiro dia do mês seguinte', async () => {
  mockStore.transactions = [{ ...tx, date: '2026-10-10' }];
  const ui = await screen();
  fireEvent.press(ui.getByLabelText('Próximo mês'));
  fireEvent.press(ui.getByLabelText(/1 de Novembro,/));
  expect(ui.getByText('Fatura de Cartão — reserva do mês')).toBeTruthy();
});

it('controla a reserva diretamente na tela e preserva a preferência ao reabrir', async () => {
  mockStore.transactions = [{ ...tx, date: '2026-10-10' }];
  const ui = await screen();
  expect(ui.getByText('Faturas no dia 1')).toBeTruthy();
  fireEvent.press(ui.getByLabelText('Próximo mês'));
  expect(ui.getByLabelText(`1 de Novembro, saldo ${formatCurrency(800)}`)).toBeTruthy();
  await act(async () => fireEvent(ui.getByLabelText('Reservar faturas no primeiro dia dos próximos meses'), 'valueChange', false));
  expect(ui.getByLabelText(`1 de Novembro, saldo ${formatCurrency(1000)}`)).toBeTruthy();
  expect(ui.getByLabelText(`5 de Novembro, saldo ${formatCurrency(800)}`)).toBeTruthy();
  expect(await AsyncStorage.getItem('@horizonte:reserve_future_invoices')).toBe('false');
  ui.unmount();
  const reopened = await screen();
  expect(reopened.getByLabelText('Reservar faturas no primeiro dia dos próximos meses').props.value).toBe(false);
});

it('ativa a reserva na grade mesmo quando as faturas estavam excluídas', async () => {
  await AsyncStorage.multiSet([['@horizonte:include_card_invoices', 'false'], ['@horizonte:view_mode', 'grid']]);
  mockStore.transactions = [{ ...tx, date: '2026-10-10' }];
  const ui = await screen();
  const toggle = ui.getByLabelText('Reservar faturas no primeiro dia dos próximos meses');
  expect(toggle.props.value).toBe(false);
  await act(async () => fireEvent(toggle, 'valueChange', true));
  expect(ui.getByLabelText(`1 Nov, saldo ${formatCurrency(800)}`)).toBeTruthy();
  expect(await AsyncStorage.getItem('@horizonte:include_card_invoices')).toBe('true');
  expect(await AsyncStorage.getItem('@horizonte:reserve_future_invoices')).toBe('true');
});

it('informa falha ao salvar o controle e conserva o cálculo anterior', async () => {
  const ui = await screen();
  jest.mocked(AsyncStorage.multiSet).mockRejectedValueOnce(new Error('Sem espaço'));
  await act(async () => fireEvent(ui.getByLabelText('Reservar faturas no primeiro dia dos próximos meses'), 'valueChange', false));
  expect(ui.getByText('Não foi possível salvar a opção de faturas. Tente novamente.')).toBeTruthy();
  expect(ui.getByLabelText('Reservar faturas no primeiro dia dos próximos meses').props.value).toBe(true);
});
