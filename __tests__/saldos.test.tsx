import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SaldosScreen, SaldosViewState } from '../components/screens/SaldosScreen';
import { buildFinancialIndex } from '../lib/financialIndex';
import { Transaction, Account } from '../constants/types';
import { formatCurrency } from '../lib/utils';
let mockStore: any;
let mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ colors: require('../constants/theme').Colors.light }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: any) => require('react').createElement(require('react-native').Text, null, name) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-gesture-handler', () => ({ Swipeable: require('react').forwardRef(({ children }: any, ref: any) => {
  require('react').useImperativeHandle(ref, () => ({ close: jest.fn() })); return children;
}) }));
jest.mock('../components/ProjectTransactionsModal', () => ({ ProjectTransactionsModal: () => null }));
jest.mock('../components/RecurrenceActionModal', () => ({ RecurrenceActionModal: () => null }));
const bank: Account = { id: 'a', name: 'Conta A', balance: 0, type: 'corrente', color: '#000', icon: 'wallet' };
const entry = (values: Partial<Transaction>): Transaction => ({ id: 't', description: 'Salário', amount: 100, date: '2026-10-10', accountId: 'a', type: 'receita', recurrence: 'unica', paid: true, ...values });
function refresh() { mockStore.financialIndex = buildFinancialIndex(mockStore.accounts, mockStore.transactions, mockStore.goals, new Date(2026, 9, 17)); }
beforeEach(() => {
  mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 };
  jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 17, 12));
  mockStore = { accounts: [{ ...bank }], transactions: [], goals: [], projects: [], tags: [], today: '2026-10-17',
    homeLayout: [{ id: 'balance', visible: true }, { id: 'transactions', visible: true }], updateTransaction: jest.fn().mockResolvedValue(undefined), deleteTransaction: jest.fn().mockResolvedValue(undefined) };
  refresh();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it.each([[320, 1], [360, 1], [412, 1], [360, 2], [780, 1]])('mantém ações e valores completos com largura %i e fonte %i', (width, fontScale) => {
  mockDimensions = { width, fontScale, height: width > 500 ? 360 : 780, scale: 3 };
  mockStore.transactions = [entry({ amount: 123456789.99, paid: false, description: 'Descrição longa para verificar leitura e confirmação do lançamento' })];
  refresh();
  const screen = render(<SaldosScreen />);
  expect(screen.getByText(`+${formatCurrency(123456789.99)}`)).toBeTruthy();
  expect(screen.getByLabelText(/Confirmar recebimento de Descrição longa/)).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Filtrar lançamentos, 0 filtros ativos'));
  fireEvent.press(screen.getByText('Receita'));
  fireEvent.press(screen.getByText('Cancelar'));
  expect(screen.getByLabelText('Filtrar lançamentos, 0 filtros ativos')).toBeTruthy();
});

it('mostra projeção acumulada, rótulos de período e valores realizados separados', () => {
  mockStore.transactions = [entry({ id: 'initial', amount: 1000, isAdjustment: true }), entry({ id: 'oct', type: 'despesa', amount: 500, paid: false }), entry({ id: 'nov', type: 'despesa', amount: 300, paid: false, date: '2026-11-10' }), entry({ id: 'dec', amount: 200, paid: false, date: '2026-12-10' })]; refresh();
  const screen = render(<SaldosScreen />);
  fireEvent.press(screen.getByLabelText('Próximo mês')); fireEvent.press(screen.getByLabelText('Próximo mês'));
  expect(screen.getByText('Saldo projetado ao fim do mês')).toBeTruthy();
  expect(screen.getByText(formatCurrency(400))).toBeTruthy();
  expect(screen.getByText('Receitas realizadas')).toBeTruthy();
  expect(screen.getByText('Receitas previstas')).toBeTruthy();
});
it('mantém seletor de mês mesmo com a lista oculta e retorna ao mês atual', () => {
  mockStore.homeLayout[1].visible = false;
  const screen = render(<SaldosScreen />);
  fireEvent.press(screen.getByLabelText('Próximo mês'));
  expect(screen.getByText('novembro de 2026')).toBeTruthy();
  fireEvent.press(screen.getByText('Mês atual'));
  expect(screen.queryByText(/novembro de 2026/)).toBeNull();
  expect(screen.queryByLabelText('Buscar lançamentos')).toBeNull();
});
it('cancelar não aplica filtros e aplicar restringe a lista ao status escolhido', () => {
  mockStore.transactions = [entry({ description: 'Receita confirmada' }), entry({ id: 'late', description: 'Conta atrasada', paid: false, type: 'despesa' })]; refresh();
  const screen = render(<SaldosScreen />);
  fireEvent.press(screen.getByLabelText('Filtrar lançamentos, 0 filtros ativos'));
  fireEvent.press(screen.getAllByText('Vencido').at(-1)!);
  fireEvent.press(screen.getByText('Cancelar'));
  expect(screen.getByText('Receita confirmada')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Filtrar lançamentos, 0 filtros ativos'));
  fireEvent.press(screen.getAllByText('Vencido').at(-1)!);
  fireEvent.press(screen.getByText('Aplicar filtros'));
  expect(screen.queryByText('Receita confirmada')).toBeNull();
  expect(screen.getByText('Conta atrasada')).toBeTruthy();
});
it('busca sem acentos e diferencia filtros vazios com ação para limpar', () => {
  mockStore.transactions = [entry({})]; refresh();
  const screen = render(<SaldosScreen />);
  fireEvent.changeText(screen.getByLabelText('Buscar lançamentos'), 'salario');
  expect(screen.getByText('Salário')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Buscar lançamentos'), 'inexistente');
  expect(screen.getByText('Nenhum lançamento corresponde aos filtros.')).toBeTruthy();
  fireEvent.press(screen.getByText('Limpar filtros'));
  expect(screen.getByText('Salário')).toBeTruthy();
});
it('mostra status e transferência como entrada ao filtrar pelo destinatário', () => {
  mockStore.accounts.push({ ...bank, id: 'b', name: 'Conta B' });
  mockStore.transactions = [entry({ type: 'transferencia', targetAccountId: 'b', description: 'Reserva' })]; refresh();
  const screen = render(<SaldosScreen />);
  expect(screen.getByText('Transferido')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Filtrar lançamentos, 0 filtros ativos'));
  fireEvent.press(screen.getByText('Conta B')); fireEvent.press(screen.getByText('Aplicar filtros'));
  expect(screen.getByText(`+${formatCurrency(100)}`)).toBeTruthy();
  expect(screen.getByText(/Conta A → Conta B/)).toBeTruthy();
});
it('preserva período, filtros e paginação após desmontar e voltar à aba', () => {
  const viewStateRef: React.MutableRefObject<SaldosViewState | null> = { current: null };
  const first = render(<SaldosScreen viewStateRef={viewStateRef} />);
  fireEvent.press(first.getByLabelText('Próximo mês'));
  fireEvent.changeText(first.getByLabelText('Buscar lançamentos'), 'viagem');
  first.unmount();
  const second = render(<SaldosScreen viewStateRef={viewStateRef} />);
  expect(second.getByText('novembro de 2026')).toBeTruthy();
  expect(second.getByDisplayValue('viagem')).toBeTruthy();
});
it('confirma recebimento somente após consentimento e salva a realização hoje', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  mockStore.transactions = [entry({ paid: false })]; refresh();
  const screen = render(<SaldosScreen />);
  fireEvent.press(screen.getByLabelText('Confirmar recebimento de Salário'), { stopPropagation: jest.fn() });
  expect(mockStore.updateTransaction).not.toHaveBeenCalled();
  await act(async () => { await alert.mock.calls[0][2]![1].onPress!(); });
  expect(mockStore.updateTransaction).toHaveBeenCalledWith(expect.objectContaining({ paid: true, date: '2026-10-17' }), 'single');
});
it('cards oferecem atalhos e metas com aporte zero mostram sem previsão', () => {
  mockStore.accounts.push({ ...bank, id: 'card', name: 'Meu cartão', type: 'cartao_credito' });
  mockStore.goals = [{ id: 'g', name: 'Reserva', savedAmount: 0, targetAmount: 1000, monthlyContribution: 0, color: '#000', icon: 'flag' }];
  mockStore.homeLayout = [{ id: 'accounts', visible: true }, { id: 'goals', visible: true }]; refresh();
  const onNavigate = jest.fn();
  const screen = render(<SaldosScreen onNavigate={onNavigate} />);
  fireEvent.press(screen.getByLabelText('Abrir cartão Meu cartão'));
  expect(onNavigate).toHaveBeenCalledWith('cartao', 'card');
  fireEvent.press(screen.getByLabelText('Gerenciar meta Reserva'));
  expect(onNavigate).toHaveBeenCalledWith('metas', 'g');
  expect(screen.getByText(/Sem previsão/)).toBeTruthy();
});
it('oculta valores monetários inclusive na acessibilidade dos lançamentos', () => {
  mockStore.transactions = [entry({ amount: 4321.23 })]; refresh();
  const screen = render(<SaldosScreen />);
  fireEvent.press(screen.getByLabelText('Ocultar valores'));
  expect(screen.queryByText(formatCurrency(4321.23))).toBeNull();
  expect(screen.getByLabelText('Salário, Recebido, valor oculto')).toBeTruthy();
});
it('oferece ajustes no filtro sem misturá-los aos subtotais de receita', () => {
  mockStore.transactions = [entry({ description: 'Saldo inicial', isAdjustment: true, amount: 987 })]; refresh();
  const screen = render(<SaldosScreen />);
  expect(screen.queryByText('Saldo inicial')).toBeNull();
  fireEvent.press(screen.getByLabelText('Filtrar lançamentos, 0 filtros ativos'));
  fireEvent(screen.getByLabelText('Mostrar ajustes e saldos iniciais'), 'valueChange', true);
  fireEvent.press(screen.getByText('Aplicar filtros'));
  expect(screen.getByText('Saldo inicial')).toBeTruthy();
  expect(screen.getByText(/Ajuste de saldo/)).toBeTruthy();
});
