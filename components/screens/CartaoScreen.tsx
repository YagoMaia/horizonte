import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Modal, Alert, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { dayKey, financialDate } from '@/lib/financialDate';
import { invoiceDates, invoiceStatus, parseMoney, shiftMonth } from '@/lib/cardInvoices';
import { normalizeSearch, PaymentStatus } from '@/lib/financialIndex';
import { Account } from '@/constants/types';
import { TransactionItem } from '../TransactionItem';
export interface CardViewState {
    cardId: string;
    month: string;
    query: string;
    status: string;
    hidden: boolean;
}
interface Props {
    onSelectCard?: (card: Account | null) => void;
    initialCardId?: string;
    viewStateRef?: React.MutableRefObject<CardViewState | null>;
    onManageAccounts?: () => void;
    hiddenValues?: boolean;
    onHiddenValuesChange?: (hidden: boolean) => void;
}
const labelMonth = (month: string) => financialDate(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
export function paymentDateFromText(text: string) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text))
        throw new Error('Use a data no formato DD/MM/AAAA.');
    const [d, m, y] = text.split('/').map(Number), date = new Date(y, m - 1, d, 12);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
        throw new Error('Informe uma data válida.');
    return date;
}
const message = (title: string, body: string) => Platform.OS === 'web' ? window.alert(`${title}\n${body}`) : Alert.alert(title, body);
export function CartaoScreen({ onSelectCard, initialCardId, viewStateRef, onManageAccounts, hiddenValues, onHiddenValuesChange }: Props) {
    const { colors } = useTheme(), insets = useSafeAreaInsets();
    const { accounts, transactions, financialIndex, today, payCreditCardInvoice, anticipateCreditCardPayment, deleteMultipleTransactions, reverseCardPayment } = useStoreContext();
    const cards = useMemo(() => accounts.filter(a => a.type === 'cartao_credito'), [accounts]);
    const initial = useRef(viewStateRef?.current);
    const [cardId, setCardId] = useState(initial.current?.cardId || initialCardId || 'all');
    const [month, setMonth] = useState(initial.current?.month || today.slice(0, 7));
    const [query, setQuery] = useState(initial.current?.query || '');
    const [status, setStatus] = useState(initial.current?.status || 'todos');
    const [hidden, setHidden] = useState(hiddenValues ?? initial.current?.hidden ?? false);
    const [mode, setMode] = useState<'pay' | 'partial' | 'mark' | 'delete' | 'reverse' | 'month' | null>(null);
    const [sourceId, setSourceId] = useState(''), [amount, setAmount] = useState(''), [date, setDate] = useState('');
    const [busy, setBusy] = useState(false), busyRef = useRef(false);
    const [monthInput, setMonthInput] = useState('');
    const [reverseId, setReverseId] = useState('');
    const [error, setError] = useState('');
    const card = cards.find(c => c.id === cardId);
    const banks = useMemo(() => accounts.filter(a => a.type !== 'cartao_credito'), [accounts]);
    const ledger = financialIndex.cardIndex;
    const selected = useMemo(() => card ? [card] : cards, [card, cards]);
    const invoices = useMemo(() => selected.map(c => ledger.invoices.get(`${c.id}:${month}`)).filter((v): v is NonNullable<typeof v> => !!v), [selected, ledger, month]);
    const rows = useMemo(() => invoices.flatMap(i => i.rows).sort((a, b) => financialDate(b.date).getTime() - financialDate(a.date).getTime()), [invoices]);
    const payments = useMemo(() => {
        if (!card)
            return [];
        const ids = new Set(rows.map(t => t.settledByPaymentId).filter((id): id is string => !!id));
        transactions.forEach(t => { if (t.paidCardId === card.id && t.invoiceMonth === month && t.cardPaymentId)
            ids.add(t.cardPaymentId); });
        return [...ids].map(id => { const bank = transactions.find(t => t.cardPaymentId === id && t.paymentMethod === 'debito'); const settled = rows.find(t => t.settledByPaymentId === id); return { id, date: bank?.date || settled?.settledAt || today, amount: bank?.amount }; });
    }, [card, rows, transactions, month, today]);
    const filtered = useMemo(() => rows.filter(t => (!query.trim() || normalizeSearch(t.description).includes(normalizeSearch(query.trim()))) && (status === 'todos' || financialIndex.metadata.get(t.id)?.status === status)), [rows, query, status, financialIndex]);
    const sum = (field: 'pending' | 'total' | 'rawPending' | 'creditApplied') => invoices.reduce((s, i) => s + i[field], 0) / 100;
    const remaining = sum('pending'), total = sum('total'), settled = total - sum('rawPending'), applied = sum('creditApplied');
    const dates = card ? invoiceDates(month, card) : null;
    const earlier = useMemo(() => [...ledger.invoices.values()].filter(i => selected.some(c => c.id === i.cardId) && i.month < month && i.pending > 0).sort((a, b) => a.month.localeCompare(b.month)), [ledger, selected, month]);
    const money = (value: number) => hidden ? '••••' : formatCurrency(value);
    const text = { color: colors.foreground }, muted = { color: colors.mutedForeground }, surface = { backgroundColor: colors.card, borderColor: colors.border };
    useEffect(() => { if (cardId !== 'all' && !cards.some(c => c.id === cardId))
        setCardId('all'); }, [cards, cardId]);
    useEffect(() => { onSelectCard?.(card || null); }, [card, onSelectCard]);
    useEffect(() => { if (hiddenValues !== undefined)
        setHidden(hiddenValues); }, [hiddenValues]);
    useEffect(() => { if (viewStateRef)
        viewStateRef.current = { cardId, month, query, status, hidden }; }, [cardId, month, query, status, hidden, viewStateRef]);
    const lastToday = useRef(today);
    useEffect(() => { const previous = lastToday.current.slice(0, 7); if (previous !== today.slice(0, 7))
        setMonth(m => m === previous ? today.slice(0, 7) : m); lastToday.current = today; }, [today]);
    const open = (next: NonNullable<typeof mode>) => { setMonthInput(month.split('-').reverse().join('/')); setSourceId(banks[0]?.id || ''); setAmount(''); setDate(formatDate(today)); setError(''); setMode(next); };
    const close = () => { if (!busyRef.current)
        setMode(null); };
    const run = async (scope: 'invoice' | 'family' = 'invoice') => {
        if (busyRef.current || !card || !mode)
            return;
        busyRef.current = true;
        setBusy(true);
        setError('');
        try {
            const [year, m] = month.split('-').map(Number);
            if (mode === 'reverse')
                await reverseCardPayment(reverseId);
            else if (mode === 'delete')
                await deleteMultipleTransactions(rows.map(t => t.id), scope);
            else {
                const paidAt = paymentDateFromText(date);
                if (mode === 'partial')
                    await anticipateCreditCardPayment(card.id, sourceId, parseMoney(amount), m - 1, year, paidAt);
                else
                    await payCreditCardInvoice(card.id, mode === 'mark' ? null : sourceId, m - 1, year, mode !== 'mark', paidAt);
            }
            setMode(null);
            message('Concluído', mode === 'delete' ? 'Lançamentos excluídos.' : mode === 'reverse' ? 'Registro desfeito no aplicativo. Nenhuma operação bancária foi executada.' : 'Registro salvo no aplicativo. Nenhuma operação bancária foi executada.');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.');
        }
        finally {
            busyRef.current = false;
            setBusy(false);
        }
    };
    const chip = (title: string, active: boolean, action: () => void) => <TouchableOpacity key={title} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={action} style={[styles.chip, { backgroundColor: active ? colors.foreground : colors.card, borderColor: colors.border }]}><Text style={{ color: active ? colors.background : colors.foreground }}>{title}</Text></TouchableOpacity>;
    const button = (title: string, action: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[styles.button, surface, { opacity: disabled ? 0.5 : 1 }]}><Text style={[text, { textAlign: 'center' }]}>{title}</Text></TouchableOpacity>;
    const header = <View style={styles.section}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {chip('Todos', cardId === 'all', () => setCardId('all'))}{cards.map(c => chip(c.name, cardId === c.id, () => setCardId(c.id)))}
    </ScrollView>
    <View style={styles.monthNav}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fatura do mês anterior" onPress={() => setMonth(m => shiftMonth(m, -1))} style={styles.iconButton}><Ionicons name="chevron-back" size={24} color={colors.foreground}/></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Escolher competência" style={{ flex: 1, paddingVertical: 12 }} onPress={() => open('month')}><Text accessibilityRole="header" style={[styles.title, text, { textAlign: 'center' }]}>{labelMonth(month)}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fatura do próximo mês" onPress={() => setMonth(m => shiftMonth(m, 1))} style={styles.iconButton}><Ionicons name="chevron-forward" size={24} color={colors.foreground}/></TouchableOpacity>
    </View>
    <View style={styles.wrap}>{button('Mês atual', () => setMonth(today.slice(0, 7)))}{button(hidden ? 'Mostrar valores' : 'Ocultar valores', () => { setHidden(!hidden); onHiddenValuesChange?.(!hidden); })}</View>
    <Text style={[styles.caption, muted]}>Competência de vencimento. Todos os cartões usam o mesmo mês.</Text>
    <View style={[styles.card, surface]}>
      <Text style={[styles.title, text]}>{card?.name || 'Todos os cartões'}</Text>
      <Text style={muted}>Restante a pagar</Text><Text style={[styles.amount, text]}>{money(remaining)}</Text>
      <Text style={[styles.caption, muted]}>Total líquido: {money(total)} • Quitado: {money(settled)}</Text>
      <Text style={[styles.caption, muted]}>Crédito de meses anteriores aplicado: {money(applied)}</Text>
      {dates && <Text style={[styles.caption, text]}>Fechamento: {formatDate(dates.closing)} • Vencimento: {formatDate(dates.due)}</Text>}
      {card && <Text style={[styles.label, text]}>{invoiceStatus(invoices[0], today)}</Text>}
      {card && <>
        <Text style={[styles.caption, muted]}>Compromissos registrados, com parcelas futuras: {money((ledger.debt.get(card.id) || 0) / 100)}</Text>
        <Text style={[styles.caption, muted]}>Crédito disponível para próximas faturas: {money((ledger.creditBalances.get(card.id) || 0) / 100)}</Text>
        {card.creditLimit !== undefined && <Text style={[styles.caption, muted]}>Limite cadastrado: {money(card.creditLimit)} • Disponível estimado: {money(Math.max(0, card.creditLimit - (ledger.debt.get(card.id) || 0) / 100))}. Confira o limite efetivo no banco.</Text>}
      </>}
    </View>
    {!card && cards.map(c => { const invoice = ledger.invoices.get(`${c.id}:${month}`); return <TouchableOpacity key={c.id} accessibilityRole="button" accessibilityLabel={`Consultar fatura de ${c.name}`} onPress={() => setCardId(c.id)} style={[styles.card, surface]}><Text style={[styles.label, text]}>{c.name}</Text><Text style={text}>{money((invoice?.pending || 0) / 100)} • {invoiceStatus(invoice, today)}</Text><Text style={[styles.caption, muted]}>Vence em {formatDate(invoiceDates(month, c).due)}</Text></TouchableOpacity>; })}
    {earlier.length > 0 && button(`Consultar ${earlier.length} fatura(s) anterior(es) pendente(s)`, () => setMonth(earlier[0].month))}
    {card && <>
      <View style={styles.wrap}>{button('Registrar pagamento', () => open('pay'), remaining <= 0 || banks.length === 0)}{button('Antecipar valor parcial', () => open('partial'), remaining <= 0 || banks.length === 0)}</View>
      {button('Registrar pagamento feito fora do app', () => open('mark'), remaining <= 0 && applied <= 0)}
      {banks.length === 0 && <Text style={muted}>Cadastre uma conta para registrar saída de dinheiro.</Text>}
    </>}
    {card && payments.map((p, i) => <View key={p.id} style={[styles.card, surface]}><Text style={text}>Registro {i + 1} • {formatDate(p.date)} • {p.amount === undefined ? 'Sem débito em conta' : money(p.amount)}</Text>{button('Estornar registro ' + (i + 1), () => { setReverseId(p.id); open('reverse'); })}</View>)}
    <Text style={[styles.title, text]}>Itens da fatura</Text>
    <TextInput accessibilityLabel="Buscar na fatura" placeholder="Buscar descrição" placeholderTextColor={colors.mutedForeground} value={query} onChangeText={setQuery} style={[styles.input, surface, text]}/>
    <View style={styles.wrap}>{(['todos', 'realizado', 'previsto', 'vencido'] as const).map(s => chip({ todos: 'Todos os itens', realizado: 'Realizados', previsto: 'Previstos', vencido: 'Vencidos' }[s], status === s, () => setStatus(s)))}</View>
    <Text style={[styles.caption, muted]}>{filtered.length} de {rows.length} itens. Busca e situação afetam somente a lista.</Text>
    {card && rows.length > 0 && button('Excluir lançamentos da fatura', () => open('delete'))}
  </View>;
    return <View style={{ flex: 1, backgroundColor: colors.background }}>
    {cards.length === 0 ? <View style={styles.card}><Text style={[styles.title, text]}>Nenhum cartão cadastrado.</Text>{button('Cadastrar cartão', () => onManageAccounts?.())}</View> : <FlatList data={filtered} keyExtractor={t => t.id} ListHeaderComponent={header} renderItem={({ item }) => <TransactionItem transaction={item} account={financialIndex.accountById.get(item.accountId)} colors={colors} showAccount={!card} status={financialIndex.metadata.get(item.id)?.status as PaymentStatus} hideValues={hidden}/>} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} ListEmptyComponent={<Text style={[styles.empty, muted]}>{rows.length ? 'Nenhum item corresponde à busca ou situação.' : 'Nenhum lançamento nesta competência.'}</Text>}/>}
    <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.modal, surface, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.section}>
            <Text accessibilityRole="header" style={[styles.title, text]}>{mode === 'month' ? 'Escolher competência' : mode === 'reverse' ? 'Estornar registro' : mode === 'delete' ? 'Excluir lançamentos' : mode === 'partial' ? 'Antecipação parcial' : mode === 'mark' ? 'Pagamento feito fora do app' : 'Registrar pagamento'}</Text>
            <Text style={[styles.caption, muted]}>{card?.name} • {labelMonth(month)}</Text>
            {mode === 'month' ? <>
              <Text style={text}>Mês e ano do vencimento (MM/AAAA)</Text>
              <TextInput accessibilityLabel="Competência da fatura" value={monthInput} onChangeText={setMonthInput} placeholder="MM/AAAA" keyboardType="numbers-and-punctuation" style={[styles.input, surface, text]}/>
              {button('Consultar competência', () => { if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(monthInput) || Number(monthInput.slice(3)) < 1900) {
            setError('Informe mês e ano válidos no formato MM/AAAA.');
            return;
        } setMonth(monthInput.split('/').reverse().join('-')); setMode(null); })}
            </> : mode === 'reverse' ? <><Text style={text}>Desfaz o registro local, restaura o saldo da conta e reabre os itens quitados. Isso não cancela pagamentos feitos no banco.</Text>{button('Confirmar estorno local', () => void run(), busy)}</> : mode === 'delete' ? <>
              <Text style={text}>A exclusão da fatura remove seus itens. A opção de famílias também alcança parcelas e recorrências em outros meses. Registros vinculados a pagamentos são protegidos.</Text>
              {button('Excluir somente esta fatura', () => void run('invoice'), busy)}
              {button('Excluir também as famílias', () => void run('family'), busy)}
            </> : <>
              <Text style={[styles.caption, text]}>Restante desta fatura: {money(remaining)}.</Text>
              {mode === 'mark' && <Text style={text}>Marca os itens como pagos e remove a dívida das projeções. Não altera o saldo de nenhuma conta. Use quando o pagamento já ocorreu e não deve gerar outra saída.</Text>}
              {mode === 'partial' && <><Text style={text}>Valor em reais (ex.: 1.234,56), até o restante desta fatura.</Text><TextInput accessibilityLabel="Valor a antecipar" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0,00" placeholderTextColor={colors.mutedForeground} style={[styles.input, surface, text]}/></>}
              <Text style={text}>Data real do pagamento (até hoje)</Text><TextInput accessibilityLabel="Data do pagamento" value={date} onChangeText={setDate} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" style={[styles.input, surface, text]}/>
              {mode !== 'mark' && <><Text style={[styles.label, text]}>Debitar de</Text>{banks.map(a => chip(a.name, sourceId === a.id, () => setSourceId(a.id)))}</>}
              {button(busy ? 'Salvando…' : 'Confirmar registro', () => void run(), busy || (mode !== 'mark' && !sourceId))}
            </>}
            {!!error && <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text>}
            {button('Cancelar', close, busy)}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
    content: { padding: 16, paddingBottom: 32 }, section: { gap: 12, paddingBottom: 16 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chips: { gap: 8 }, chip: { padding: 12, minHeight: 48, borderWidth: 1, borderRadius: 16 },
    monthNav: { flexDirection: 'row', alignItems: 'center' }, iconButton: { padding: 12, minWidth: 48, minHeight: 48 }, title: { fontSize: 18, fontWeight: '700', flexShrink: 1 }, label: { fontSize: 15, fontWeight: '600' }, caption: { fontSize: 13, lineHeight: 20 },
    card: { padding: 18, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18 }, amount: { fontSize: 30, fontWeight: '700', flexShrink: 1 }, button: { padding: 14, minHeight: 48, borderRadius: 12, borderWidth: 1, flexShrink: 1 }, input: { padding: 14, fontSize: 16, borderWidth: 1, borderRadius: 12 }, empty: { padding: 24 },
    overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }, modal: { width: '100%', maxWidth: 560, maxHeight: '90%', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
