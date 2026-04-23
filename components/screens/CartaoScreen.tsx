// components/screens/CartaoScreen.tsx
import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency } from '@/lib/utils';

const { width } = Dimensions.get('window');

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function CartaoScreen() {
    const { colors } = useTheme();
    const { transactions, tags } = useStoreContext();

    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    // Navegação de meses
    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((v) => v + 1);
        } else setViewMonth((v) => v + 1);
    };

    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((v) => v - 1);
        } else setViewMonth((v) => v - 1);
    };

    // Filtra apenas despesas do mês/ano selecionado e que sejam no CRÉDITO
    const billTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            const d = new Date(tx.date);
            return (
                d.getFullYear() === viewYear &&
                d.getMonth() === viewMonth &&
                tx.type === 'despesa' &&
                tx.paymentMethod === 'credito' // 👉 A MÁGICA ACONTECE AQUI
            );
        });
    }, [transactions, viewYear, viewMonth]);

    const totalBill = billTransactions.reduce((acc, tx) => acc + tx.amount, 0);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header de Navegação */}
            <View style={[styles.navHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </TouchableOpacity>

                <View style={styles.monthInfo}>
                    <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>Fatura de</Text>
                    <Text style={[styles.monthValue, { color: colors.foreground }]}>
                        {MONTH_NAMES[viewMonth]} {viewYear}
                    </Text>
                </View>

                <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="chevron-forward" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Cartão Visual da Fatura */}
                <View style={[styles.cardVisual, { backgroundColor: colors.primary }]}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="card" size={28} color="#FFF" />
                        <Text style={styles.cardBrand}>CRÉDITO</Text>
                    </View>

                    <View style={styles.cardBody}>
                        <Text style={styles.cardLabel}>Valor total da fatura</Text>
                        <Text style={styles.cardAmount}>{formatCurrency(totalBill)}</Text>
                    </View>

                    <View style={styles.cardFooter}>
                        <View style={styles.chip} />
                        <Text style={styles.cardStatus}>
                            {viewYear < today.getFullYear() || (viewYear === today.getFullYear() && viewMonth < today.getMonth())
                                ? 'FATURA FECHADA'
                                : 'FATURA EM ABERTO'}
                        </Text>
                    </View>
                </View>

                {/* Lista de Lançamentos */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ITENS DA FATURA</Text>
                    <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>
                        {billTransactions.length} itens
                    </Text>
                </View>

                {billTransactions.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={48} color={colors.border} />
                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                            Nenhum gasto planejado para este mês.
                        </Text>
                    </View>
                ) : (
                    <View style={[styles.listContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {billTransactions.map((tx, idx) => {
                            const tag = tags.find((t) => t.id === tx.tagIds[0]);
                            return (
                                <View
                                    key={tx.id}
                                    style={[
                                        styles.txRow,
                                        idx < billTransactions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
                                    ]}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: tag?.color + '15' || colors.secondary }]}>
                                        <Ionicons name={(tag?.icon as any) || 'basket-outline'} size={20} color={tag?.color || colors.primary} />
                                    </View>

                                    <View style={styles.txInfo}>
                                        <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                                            {tx.description}
                                        </Text>
                                        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                                            {new Date(tx.date).toLocaleDateString('pt-BR')}
                                        </Text>
                                    </View>

                                    <Text style={[styles.txValue, { color: colors.foreground }]}>
                                        {formatCurrency(tx.amount)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Dica de Segurança */}
                <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.foreground }]}>
                        Esta visão ajuda você a antecipar gastos parcelados e planejar o pagamento da fatura sem comprometer seu saldo.
                    </Text>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    navHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    monthInfo: {
        alignItems: 'center',
    },
    monthLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
        fontWeight: '700',
        letterSpacing: 1,
    },
    monthValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    cardVisual: {
        margin: 20,
        padding: 25,
        borderRadius: 24,
        height: 200,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardBrand: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
        opacity: 0.8,
    },
    cardBody: {
        marginTop: 10,
    },
    cardLabel: {
        color: '#FFF',
        fontSize: 14,
        opacity: 0.8,
    },
    cardAmount: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '800',
        marginTop: 5,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chip: {
        width: 40,
        height: 30,
        backgroundColor: '#FFD700',
        borderRadius: 6,
        opacity: 0.5,
    },
    cardStatus: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    itemCount: {
        fontSize: 12,
    },
    listContainer: {
        marginHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txInfo: {
        flex: 1,
    },
    txDesc: {
        fontSize: 15,
        fontWeight: '600',
    },
    txDate: {
        fontSize: 12,
        marginTop: 2,
    },
    txValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 10,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    infoBox: {
        margin: 20,
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        opacity: 0.8,
    },
});