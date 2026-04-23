// components/screens/CartaoScreen.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Modal,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency } from '@/lib/utils';
import { Transaction } from '@/constants/types';
import { AddTransactionModal } from '@/components/AddTransactionModal';

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function CartaoScreen() {
    const { colors } = useTheme();
    const { transactions, tags, accounts, deleteTransaction, updateTransaction } = useStoreContext();

    const today = useMemo(() => new Date(), []);
    const [selectedCardId, setSelectedCardId] = useState<string>('all');

    // Lógica para descobrir qual é a fatura aberta atual
    const openInvoice = useMemo(() => {
        const activeCard = accounts.find(acc => acc.id === selectedCardId);
        const closingDay = activeCard?.closingDay || 31;
        const currentDay = today.getDate();

        let targetMonth = today.getMonth() + 1;
        let targetYear = today.getFullYear();

        if (currentDay >= closingDay) {
            targetMonth += 1;
        }

        if (targetMonth > 11) {
            targetMonth -= 12;
            targetYear += 1;
        }

        return { month: targetMonth, year: targetYear, value: targetYear * 100 + targetMonth };
    }, [selectedCardId, accounts, today]);

    const [viewYear, setViewYear] = useState(openInvoice.year);
    const [viewMonth, setViewMonth] = useState(openInvoice.month);

    useEffect(() => {
        setViewMonth(openInvoice.month);
        setViewYear(openInvoice.year);
    }, [openInvoice.month, openInvoice.year]);

    const [optionsModalVisible, setOptionsModalVisible] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);

    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0); setViewYear((v) => v + 1);
        } else setViewMonth((v) => v + 1);
    };

    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11); setViewYear((v) => v - 1);
        } else setViewMonth((v) => v - 1);
    };

    const creditCards = useMemo(() => accounts.filter(acc => acc.type === 'cartao_credito'), [accounts]);

    const billTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            const d = new Date(tx.date);
            const matchesMonth = d.getFullYear() === viewYear && d.getMonth() === viewMonth;
            const isCredit = tx.type === 'despesa' && tx.paymentMethod === 'credito';
            const matchesCard = selectedCardId === 'all' || tx.accountId === selectedCardId;
            return matchesMonth && isCredit && matchesCard;
        });
    }, [transactions, viewYear, viewMonth, selectedCardId]);

    const totalBill = billTransactions.reduce((acc, tx) => acc + tx.amount, 0);

    const activeCardInfo = selectedCardId === 'all'
        ? { name: 'TODOS OS CARTÕES', color: colors.primary, balance: 0 }
        : creditCards.find(c => c.id === selectedCardId) || { name: 'CARTÃO', color: colors.primary, balance: 0 };

    const isClosed = (viewYear * 100 + viewMonth) < openInvoice.value;
    const cardStatusText = isClosed ? 'FATURA FECHADA' : 'FATURA EM ABERTO';

    const handleTransactionPress = (tx: Transaction) => {
        setSelectedTx(tx);
        setOptionsModalVisible(true);
    };

    const handleEdit = () => {
        setOptionsModalVisible(false);
        setTxToEdit(selectedTx);
        setEditModalVisible(true);
    };

    const handleDelete = () => {
        if (!selectedTx) return;
        if (Platform.OS === 'web') {
            if (window.confirm(`Deseja realmente excluir "${selectedTx.description}"?`)) {
                deleteTransaction(selectedTx.id);
                setOptionsModalVisible(false);
            }
        } else {
            deleteTransaction(selectedTx.id);
            setOptionsModalVisible(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header Navegação */}
            <View style={[styles.navHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={24} color={colors.primary} /></TouchableOpacity>
                <View style={styles.monthInfo}>
                    <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>Fatura de</Text>
                    <Text style={[styles.monthValue, { color: colors.foreground }]}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
                </View>
                <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={24} color={colors.primary} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Filtros de Cartão */}
                {creditCards.length > 0 && (
                    <View style={styles.filterContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.filterChip, { borderColor: colors.border, backgroundColor: selectedCardId === 'all' ? colors.foreground : colors.card }]}
                                onPress={() => setSelectedCardId('all')}
                            >
                                <Text style={{ color: selectedCardId === 'all' ? colors.background : colors.foreground, fontWeight: '600' }}>Todos</Text>
                            </TouchableOpacity>
                            {creditCards.map(card => (
                                <TouchableOpacity
                                    key={card.id}
                                    style={[styles.filterChip, { borderColor: card.color, backgroundColor: selectedCardId === card.id ? card.color : colors.card }]}
                                    onPress={() => setSelectedCardId(card.id)}
                                >
                                    <Text style={{ color: selectedCardId === card.id ? '#FFF' : card.color, fontWeight: '600' }}>{card.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Cartão Visual com BARRA DE LIMITE */}
                <View style={[styles.cardVisual, { backgroundColor: activeCardInfo.color }]}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="card" size={28} color="#FFF" />
                        <Text style={styles.cardBrand}>{activeCardInfo.name.toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardBody}>
                        <Text style={styles.cardLabel}>Valor total da fatura</Text>
                        <Text style={styles.cardAmount}>{formatCurrency(totalBill)}</Text>

                        {selectedCardId !== 'all' && (
                            <View style={styles.limitContainer}>
                                <View style={styles.limitBarBackground}>
                                    <View style={[styles.limitBarFill, { width: `${Math.min(100, (totalBill / (activeCardInfo.balance || 1)) * 100)}%` }]} />
                                </View>
                                <View style={styles.limitInfo}>
                                    <Text style={styles.limitText}>Disponível: {formatCurrency(Math.max(0, (activeCardInfo.balance || 0) - totalBill))}</Text>
                                    <Text style={styles.limitText}>Limite: {formatCurrency(activeCardInfo.balance || 0)}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                    <View style={styles.cardFooter}>
                        <View style={styles.chip} />
                        <Text style={styles.cardStatus}>{cardStatusText}</Text>
                    </View>
                </View>

                {/* Lista de Itens */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ITENS DA FATURA</Text>
                    <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>{billTransactions.length} itens</Text>
                </View>

                <View style={[styles.listContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {billTransactions.map((tx, idx) => {
                        const tag = tags.find((t) => t.id === tx.tagIds[0]);
                        const cardOfTx = creditCards.find(c => c.id === tx.accountId);
                        return (
                            <TouchableOpacity key={tx.id} activeOpacity={0.7} onPress={() => handleTransactionPress(tx)} style={[styles.txRow, idx < billTransactions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                                <View style={[styles.iconBox, { backgroundColor: tag?.color + '15' }]}><Ionicons name={(tag?.icon as any) || 'basket-outline'} size={20} color={tag?.color || colors.primary} /></View>
                                <View style={styles.txInfo}>
                                    <Text style={[styles.txDesc, { color: colors.foreground }]}>{tx.description}</Text>
                                    <View style={styles.txSubRow}>
                                        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{new Date(tx.date).toLocaleDateString('pt-BR')}</Text>
                                        {selectedCardId === 'all' && cardOfTx && <><Text style={{ color: colors.mutedForeground, fontSize: 10 }}> • </Text><Text style={{ color: cardOfTx.color, fontSize: 11, fontWeight: '600' }}>{cardOfTx.name}</Text></>}
                                    </View>
                                </View>
                                <Text style={[styles.txValue, { color: colors.foreground }]}>{formatCurrency(tx.amount)}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Modal Opções */}
            <Modal visible={optionsModalVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOptionsModalVisible(false)}>
                    <View style={[styles.optionsMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.optionsTitle, { color: colors.foreground }]}>{selectedTx?.description}</Text>
                        <TouchableOpacity style={styles.optionBtn} onPress={handleEdit}>
                            <Ionicons name="pencil-outline" size={20} color={colors.primary} /><Text style={[styles.optionText, { color: colors.foreground }]}>Editar Lançamento</Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.optionBtn} onPress={handleDelete}>
                            <Ionicons name="trash-outline" size={20} color={colors.destructive} /><Text style={[styles.optionText, { color: colors.destructive }]}>Excluir Lançamento</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {txToEdit && (
                <AddTransactionModal
                    visible={editModalVisible}
                    onClose={() => { setEditModalVisible(false); setTxToEdit(null); }}
                    onAdd={() => { }}
                    onUpdate={(updatedTx) => { updateTransaction(updatedTx); setEditModalVisible(false); setTxToEdit(null); }}
                    accounts={accounts}
                    tags={tags}
                    transactionToEdit={txToEdit}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    navHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth },
    monthInfo: { alignItems: 'center' },
    monthLabel: { fontSize: 10, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
    monthValue: { fontSize: 18, fontWeight: '700' },
    scrollContent: { paddingBottom: 40 },
    filterContainer: { marginTop: 16, marginBottom: -4 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    cardVisual: { margin: 20, padding: 25, borderRadius: 24, height: 210, justifyContent: 'space-between', elevation: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardBrand: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    cardBody: { marginTop: 10 },
    cardLabel: { color: '#FFF', fontSize: 14, opacity: 0.8 },
    cardAmount: { color: '#FFF', fontSize: 32, fontWeight: '800' },
    limitContainer: { marginTop: 12, gap: 5 },
    limitBarBackground: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
    limitBarFill: { height: '100%', backgroundColor: '#FFF' },
    limitInfo: { flexDirection: 'row', justifyContent: 'space-between' },
    limitText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chip: { width: 40, height: 30, backgroundColor: '#FFD700', borderRadius: 6, opacity: 0.5 },
    cardStatus: { color: '#FFF', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 10 },
    sectionTitle: { fontSize: 12, fontWeight: '700' },
    itemCount: { fontSize: 12 },
    listContainer: { marginHorizontal: 20, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
    txRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    txInfo: { flex: 1 },
    txDesc: { fontSize: 15, fontWeight: '600' },
    txSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    txDate: { fontSize: 12 },
    txValue: { fontSize: 15, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    optionsMenu: { width: '80%', maxWidth: 350, borderRadius: 16, padding: 20, borderWidth: 1 },
    optionsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
    optionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
    optionText: { fontSize: 16, fontWeight: '500' },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});