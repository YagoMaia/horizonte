import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HorizonteScreen } from '../components/screens/HorizonteScreen';
import { Account, Transaction } from '../constants/types';

let mockStore: any;
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ colors: require('../constants/theme').Colors.light }) }));
jest.mock('../hooks/useToday', () => ({ useToday: () => '2026-10-01' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: any) => require('react').createElement(require('react-native').Text, null, name) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const bank: Account = { id: 'bank', name: 'Conta', balance: 1000, type: 'corrente', color: '#000', icon: 'wallet' };
const card: Account = { id: 'card', name: 'Cartão', balance: 0, type: 'cartao_credito', color: '#000', icon: 'card', closingDay: 25, dueDay: 5 };
const tx: Transaction = { id: 'purchase', description: 'Compra', amount: 200, accountId: 'card', type: 'despesa', paymentMethod: 'credito', date: '2026-09-10', recurrence: 'unica', paid: false };

beforeEach(async () => {
  await AsyncStorage.clear();
  mockStore = { accounts: [bank, card], transactions: [tx], getEffectiveBudget: jest.fn(() => 0), saveMonthlyBudget: jest.fn().mockResolvedValue(undefined) };
});

async function screen(props: React.ComponentProps<typeof HorizonteScreen> = {}) {
  const result = render(<HorizonteScreen {...props} />);
  await act(async () => { await Promise.resolve(); });
  return result;
}

it('mostra a fatura no vencimento do mês atual', async () => {
  const ui = await screen();
  fireEvent.press(ui.getByLabelText(/5 de Outubro/));
  expect(ui.getByText('Fatura de cartão')).toBeTruthy();
});

it('compartilha a ocultação de valores e permite escolher mês diretamente', async () => {
  const ui = await screen({ hiddenValues: true });
  expect(ui.getAllByText('••••').length).toBeGreaterThan(0);
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
});
