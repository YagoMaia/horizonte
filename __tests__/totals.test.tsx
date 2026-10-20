import { Transaction } from '../constants/types';
import { buildTotalsData, isInTotalsPeriod, totalsDaysElapsed } from '../lib/totals';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TotaisScreen } from '../components/screens/TotaisScreen';

let mockStore: any;
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ colors: require('../constants/theme').Colors.light }) }));
jest.mock('../hooks/useToday', () => ({ useToday: () => '2026-11-03' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: any) => require('react').createElement(require('react-native').Text, null, name) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-gesture-handler', () => ({ Swipeable: ({ children }: any) => children }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const tx = (patch: Partial<Transaction> = {}): Transaction => ({ id: 'tx', description: 'Compra', amount: 100, accountId: 'bank', type: 'despesa', date: '2026-11-01', paid: true, recurrence: 'unica', ...patch });
const today = new Date(2026, 10, 3, 12);

beforeEach(() => {
  mockStore = { transactions: [tx({ id: 'cash', amount: 80 }), tx({ id: 'credit', accountId: 'card', amount: 120, paymentMethod: 'credito' })], showPending: true, setShowPending: jest.fn(), totaisLayout: [{ id: 'stats', visible: true }, { id: 'category', visible: true }, { id: 'period', visible: true }], tags: [] };
});

it('preserva datas sem horário no mês e semana corretos', () => {
  const reference = new Date(2026, 10, 1, 12);
  expect(isInTotalsPeriod('2026-11-01', 'mes', reference)).toBe(true);
  expect(isInTotalsPeriod('2026-11-01', 'semana', reference)).toBe(true);
  expect(isInTotalsPeriod('2026-11-01', 'mes', new Date(2026, 9, 1, 12))).toBe(false);
});

it('contabiliza compras de cartão uma vez e ignora o pagamento técnico da fatura', () => {
  const data = buildTotalsData({ transactions: [
    tx({ id: 'purchase', accountId: 'card', paymentMethod: 'credito', amount: 250 }),
    tx({ id: 'payment', accountId: 'bank', amount: 250, cardPaymentId: 'payment:1', paidCardId: 'card', paymentMethod: 'debito' }),
  ], period: 'mes', refDate: new Date(2026, 10, 1, 12), today, includePending: true });
  expect(data.expense).toBe(250);
  expect(data.transactions.map(item => item.id)).toEqual(['purchase']);
  expect(data.credit).toHaveLength(1);
  expect(data.debit).toHaveLength(0);
});

it('mantém resumo e gráficos com a mesma base e exclui pagos futuros no modo realizado', () => {
  const data = buildTotalsData({ transactions: [tx({ id: 'cash', amount: 80 }), tx({ id: 'card', accountId: 'card', paymentMethod: 'credito', amount: 120 }), tx({ id: 'future', date: '2026-11-20', amount: 300 })], period: 'mes', refDate: new Date(2026, 10, 1, 12), today, includePending: false });
  expect(data.expense).toBe(200);
  expect(data.transactions.map(item => item.id)).toEqual(['cash', 'card']);
});

it('calcula a média da semana em andamento pelos dias transcorridos', () => {
  const sunday = new Date(2026, 10, 1, 12);
  expect(totalsDaysElapsed('semana', sunday, new Date(2026, 10, 3, 12))).toBe(3);
});

it('compartilha a privacidade, permite controlar pendências e escolher mês diretamente', () => {
  const ui = render(<TotaisScreen hiddenValues />);
  expect(ui.getAllByText('••••').length).toBeGreaterThan(0);
  fireEvent.press(ui.getByLabelText('Incluir lançamentos previstos'));
  expect(mockStore.setShowPending).toHaveBeenCalledWith(false);
  fireEvent.press(ui.getByLabelText('Escolher período'));
  fireEvent.press(ui.getByText('Fev'));
  expect(ui.getByText('Fevereiro 2026')).toBeTruthy();
});
