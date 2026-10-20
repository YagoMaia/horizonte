import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { CartaoScreen, CardViewState, defaultInvoiceMonth } from '../components/screens/CartaoScreen';
import { buildFinancialIndex } from '../lib/financialIndex';
import { formatCurrency } from '../lib/utils';
let mockStore: any;
jest.mock('../context/StoreContext', () => ({ useStoreContext: () => mockStore }));
jest.mock('../hooks/useTheme', () => ({ useTheme: () => ({ colors: require('../constants/theme').Colors.light }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: ({ name }: any) => require('react').createElement(require('react-native').Text, null, name) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-gesture-handler', () => ({ Swipeable: ({ children }: any) => children }));
const card: any = { id: 'c', name: 'Cartão A', type: 'cartao_credito', balance: 0, color: '#333333', icon: 'card', closingDay: 25, dueDay: 5 };
const tx = (patch: any = {}) => ({ id: 't', description: 'Compra', accountId: 'c', amount: 100, date: '2026-10-01', type: 'despesa', paymentMethod: 'credito', paid: false, recurrence: 'unica', ...patch });
function refresh() { mockStore.financialIndex = buildFinancialIndex(mockStore.accounts, mockStore.transactions, [], new Date(2026, 9, 17, 12)); }
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 17, 12)); mockStore = { today: '2026-10-17', accounts: [card, { ...card, id: 'bank', name: 'Conta', type: 'corrente' }], transactions: [tx()], payCreditCardInvoice: jest.fn().mockResolvedValue(undefined), anticipateCreditCardPayment: jest.fn().mockResolvedValue(undefined), deleteMultipleTransactions: jest.fn(), reverseCardPayment: jest.fn() }; refresh(); });
afterEach(() => { jest.useRealTimers(); });
it('abre na próxima competência comum sem somar faturas de outros meses', () => {
    mockStore.accounts.push({ ...card, id: 'b', name: 'Cartão B', dueDay: 28 });
    mockStore.transactions.push(tx({ id: 'other', accountId: 'b', amount: 200 }));
    refresh();
    const s = render(<CartaoScreen />);
    expect(s.getByText('novembro de 2026')).toBeTruthy();
    expect(s.getByText(formatCurrency(100))).toBeTruthy();
    expect(s.queryByText(formatCurrency(300))).toBeNull();
    fireEvent.press(s.getByLabelText('Fatura do próximo mês'));
    expect(s.getByText('dezembro de 2026')).toBeTruthy();
});
it('calcula a competência seguinte inclusive na virada do ano', () => {
    expect(defaultInvoiceMonth('2026-10-17')).toBe('2026-11');
    expect(defaultInvoiceMonth('2026-12-31')).toBe('2027-01');
});
it('usa vencimento da fatura no status do item', () => {
    const s = render(<CartaoScreen initialCardId="c"/>);
    expect(s.getByText('Previsto')).toBeTruthy();
    expect(s.queryByText('Vencido')).toBeNull();
    expect(s.getByText(/Vencimento: 05\/11\/2026/)).toBeTruthy();
});
it('fatura sem itens não se apresenta como paga', () => { const s = render(<CartaoScreen initialCardId="c"/>); fireEvent.press(s.getByLabelText('Fatura do próximo mês')); expect(s.getByText('SEM LANÇAMENTOS')).toBeTruthy(); expect(s.queryByText('PAGA')).toBeNull(); });
it('preserva competência e busca ao voltar à aba', () => {
    const ref: React.MutableRefObject<CardViewState | null> = { current: null };
    const s = render(<CartaoScreen initialCardId="c" viewStateRef={ref}/>);
    fireEvent.press(s.getByLabelText('Fatura do próximo mês'));
    fireEvent.changeText(s.getByLabelText('Buscar na fatura'), 'compra');
    s.unmount();
    const reopened = render(<CartaoScreen viewStateRef={ref}/>);
    expect(reopened.getByText('dezembro de 2026')).toBeTruthy();
    expect(reopened.getByDisplayValue('compra')).toBeTruthy();
});
it('aceita valor brasileiro e data real na antecipação', async () => {
    mockStore.transactions = [tx({ amount: 5000 })];
    refresh();
    const s = render(<CartaoScreen initialCardId="c"/>);
    fireEvent.press(s.getByText('Antecipar valor parcial'));
    fireEvent.changeText(s.getByLabelText('Valor a antecipar'), '1.234,56');
    fireEvent.changeText(s.getByLabelText('Data do pagamento'), '15/10/2026');
    await act(async () => { fireEvent.press(s.getByText('Confirmar registro')); });
    expect(mockStore.anticipateCreditCardPayment).toHaveBeenCalledWith('c', 'bank', 1234.56, 10, 2026, new Date(2026, 9, 15, 12));
});
it('rejeita data impossível e permite fechar modal pelo Voltar', async () => {
    const s = render(<CartaoScreen initialCardId="c"/>);
    fireEvent.press(s.getByText('Registrar pagamento'));
    fireEvent.changeText(s.getByLabelText('Data do pagamento'), '31/02/2026');
    await act(async () => { fireEvent.press(s.getByText('Confirmar registro')); });
    expect(mockStore.payCreditCardInvoice).not.toHaveBeenCalled();
    expect(s.getByText('Informe uma data válida.')).toBeTruthy();
    fireEvent(s.UNSAFE_getByType(require('react-native').Modal), 'requestClose');
    expect(s.queryByText('Confirmar registro')).toBeNull();
});
it('explica pagamento externo e respeita privacidade compartilhada', () => {
    const s = render(<CartaoScreen initialCardId="c" hiddenValues/>);
    expect(s.getByLabelText('Compra, Previsto, valor oculto')).toBeTruthy();
    fireEvent.press(s.getByText('Registrar pagamento feito fora do app'));
    expect(s.getByText(/remove a dívida das projeções/)).toBeTruthy();
});
it('oferece cancelamento claro para reabrir uma fatura paga por engano', async () => {
    mockStore.transactions = [
        tx({ paid: true, settledByPaymentId: 'payment-1', settledAt: '2026-10-17' }),
        { id: 'payment-row', accountId: 'bank', paidCardId: 'c', cardPaymentId: 'payment-1', invoiceMonth: '2026-11', description: 'Pagamento de fatura', amount: 100, date: '2026-10-17', type: 'despesa', paymentMethod: 'debito', paid: true, recurrence: 'unica' },
    ];
    refresh();
    const s = render(<CartaoScreen initialCardId="c"/>);
    fireEvent.press(s.getByText('Cancelar pagamento 1'));
    expect(s.getByText('Cancelar pagamento')).toBeTruthy();
    expect(s.getByText(/Cancela somente o registro no aplicativo/)).toBeTruthy();
    await act(async () => { fireEvent.press(s.getByText('Confirmar cancelamento local')); });
    expect(mockStore.reverseCardPayment).toHaveBeenCalledWith('payment-1');
});
it('oferece cadastro quando não há cartões', () => { mockStore.accounts = []; refresh(); const onManageAccounts = jest.fn(); const s = render(<CartaoScreen onManageAccounts={onManageAccounts}/>); fireEvent.press(s.getByText('Cadastrar cartão')); expect(onManageAccounts).toHaveBeenCalled(); });
it('permite escolher competência sem navegar por todos os meses', () => {
    const s = render(<CartaoScreen />);
    fireEvent.press(s.getByLabelText('Escolher competência'));
    fireEvent.changeText(s.getByLabelText('Competência da fatura'), '02/2027');
    fireEvent.press(s.getByText('Consultar competência'));
    expect(s.getByText('fevereiro de 2027')).toBeTruthy();
    fireEvent.press(s.getByLabelText('Fatura do próximo mês'));
    expect(s.getByText('março de 2027')).toBeTruthy();
});
