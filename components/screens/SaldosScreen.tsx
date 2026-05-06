// components/screens/SaldosScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import {
  calculateCreditCardInvoice,
  formatCurrency,
  formatDateShort,
} from '@/lib/utils';
import { useStoreContext } from '@/context/StoreContext';
import { Transaction, Account, TransactionType } from '@/constants/types';
import { TransactionDetailModal } from '../TransactionDetailModal';
import { AddTransactionModal } from '../AddTransactionModal';
import {
  GestureHandlerRootView,
  Swipeable,
} from 'react-native-gesture-handler';
import { RecurrenceActionModal } from '../RecurrenceActionModal';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function SaldosScreen() {
  const { colors } = useTheme();
  const {
    accounts,
    transactions,
    totalBalance,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    loading,
  } = useStoreContext();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [recurrenceDeleteData, setRecurrenceDeleteData] = useState<string | null>(null);
  const [simpleDeleteData, setSimpleDeleteData] = useState<Transaction | null>(null);

  // ESTADOS PARA FILTROS
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | 'todas'>('todas');
  const [filterAccountId, setFilterAccountId] = useState<string | 'todas'>('todas');

  // ESTADOS PARA NAVEGAÇÃO DE DATA
  const [currentDate, setCurrentDate] = useState(new Date());

  const activeFiltersCount =
    (filterType !== 'todas' ? 1 : 0) +
    (filterAccountId !== 'todas' ? 1 : 0);

  const rowRefs = React.useRef(new Map()).current;
  let currentlyOpenRowId: string | null = null;

  const closeCurrentlyOpenRow = () => {
    if (currentlyOpenRowId && rowRefs.get(currentlyOpenRowId)) {
      rowRefs.get(currentlyOpenRowId).close();
    }
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // CÁLCULO DE ENTRADAS E SAÍDAS DO MÊS ATUAL (Corrigido para evitar bitributação)
  const currentMonthStats = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      // Filtra pelo mês atual e apenas transações pagas
      if (
        txDate.getMonth() === currentDate.getMonth() &&
        txDate.getFullYear() === currentDate.getFullYear() &&
        tx.paid
      ) {
        if (tx.type === 'receita') {
          income += tx.amount;
        } else if (tx.type === 'despesa' && tx.paymentMethod !== 'credito') {
          // Ignora compras no crédito (a fatura, quando paga, entrará como débito aqui)
          expense += tx.amount;
        }
      }
    });

    return { income, expense };
  }, [transactions, currentDate]);

  // MOTOR DE BUSCA ATUALIZADO (Filtro por Mês)
  const displayedTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const txDate = new Date(tx.date);

        // Regra 1: Filtro de Mês e Ano
        if (txDate.getMonth() !== currentDate.getMonth() || txDate.getFullYear() !== currentDate.getFullYear()) {
          return false;
        }

        // Regra 2: Filtro de Tipo
        if (filterType !== 'todas' && tx.type !== filterType) return false;

        // Regra 3: Filtro de Conta
        if (filterAccountId !== 'todas') {
          if (tx.accountId !== filterAccountId && tx.targetAccountId !== filterAccountId) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentDate, filterType, filterAccountId]);

  const paginatedTransactions = useMemo(() => {
    return displayedTransactions.slice(0, displayLimit);
  }, [displayedTransactions, displayLimit]);

  const handleLoadMore = () => {
    if (displayLimit < displayedTransactions.length) {
      setDisplayLimit((prev) => prev + 20);
    }
  };

  React.useEffect(() => {
    setDisplayLimit(20);
    closeCurrentlyOpenRow();
  }, [currentDate, filterType, filterAccountId]);

  const clearFilters = () => {
    setFilterType('todas');
    setFilterAccountId('todas');
  };

  const handleDeletePrompt = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;
    const isFamily = tx.groupId || tx.id.includes('-');
    if (isFamily) {
      closeCurrentlyOpenRow();
      setRecurrenceDeleteData(txId);
    } else {
      closeCurrentlyOpenRow();
      setSimpleDeleteData(tx);
    }
  };

  const renderRightActions = (txId: string) => (
    <TouchableOpacity
      style={[styles.hiddenAction, styles.hiddenActionRight, { backgroundColor: colors.destructive }]}
      onPress={() => handleDeletePrompt(txId)}
    >
      <Ionicons name='trash-outline' size={24} color='#FFF' />
      <Text style={styles.hiddenActionText}>Apagar</Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      {/* 1. CARD DE SALDO TOTAL */}
      <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.balanceLabel}>Saldo Total</Text>
        <Text style={styles.balanceValue}>{formatCurrency(totalBalance)}</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceStat}>
            <Ionicons name='arrow-up-circle' size={16} color='rgba(255,255,255,0.8)' />
            <Text style={styles.balanceStatText}>{formatCurrency(currentMonthStats.income)}</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceStat}>
            <Ionicons name='arrow-down-circle' size={16} color='rgba(255,255,255,0.8)' />
            <Text style={styles.balanceStatText}>{formatCurrency(currentMonthStats.expense)}</Text>
          </View>
        </View>
      </View>

      {/* 2. SEÇÃO DE CONTAS E CARTÕES */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contas e Cartões</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.accountsRow}>
          {accounts.map((acc: Account) => {
            const isCreditCard = acc.type === 'cartao_credito';

            // Calcula a fatura atual se for cartão
            const currentInvoice = isCreditCard
              ? calculateCreditCardInvoice(acc, transactions)
              : 0;

            // Define o valor principal: 
            // Se for cartão -> valor da fatura
            // Se for conta -> saldo em conta
            const mainDisplayValue = isCreditCard ? currentInvoice : acc.balance;

            return (
              <View
                key={acc.id}
                style={[
                  styles.accountCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.accountIcon,
                    { backgroundColor: acc.color + '15' },
                  ]}
                >
                  <Ionicons
                    name={acc.icon as any}
                    size={18}
                    color={acc.color}
                  />
                </View>
                <View style={styles.accountTextContainer}>
                  <Text
                    style={[
                      styles.accountName,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {acc.name}
                  </Text>
                  <Text
                    style={[
                      styles.accountBalance,
                      { color: colors.foreground },
                    ]}
                  >
                    {formatCurrency(mainDisplayValue)}
                  </Text>

                  {/* Adiciona um identificador visual discreto apenas para cartões */}
                  {isCreditCard && (
                    <Text
                      style={[
                        styles.secondaryText,
                        { color: colors.mutedForeground, fontSize: 10 }
                      ]}
                    >
                      Fatura atual
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 3. CABEÇALHO DE LANÇAMENTOS COM O BOTÃO DE FILTRO */}
      <View style={[styles.sectionHeader, { marginTop: 8 }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lançamentos</Text>
        <TouchableOpacity
          style={[styles.filterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setIsFilterModalOpen(true)}
        >
          <Ionicons name='options-outline' size={18} color={colors.foreground} />
          {activeFiltersCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 4. BARRA DE NAVEGAÇÃO DOS MESES (Agora abaixo do botão de filtros) */}
      <View style={[styles.dateNavigator, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navArrow}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.dateLabelContainer}>
          <Text style={[styles.monthLabel, { color: colors.foreground }]}>
            {MONTHS[currentDate.getMonth()]}
          </Text>
          <Text style={[styles.yearLabel, { color: colors.mutedForeground }]}>
            {currentDate.getFullYear()}
          </Text>
        </View>

        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navArrow}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item: tx, index }: { item: Transaction; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === paginatedTransactions.length - 1;
    const isReceita = tx.type === 'receita';
    const account = accounts.find((a) => a.id === tx.accountId);

    return (
      <Swipeable
        ref={(ref) => { if (ref) rowRefs.set(tx.id, ref); }}
        renderRightActions={() => renderRightActions(tx.id)}
        onSwipeableWillOpen={() => {
          if (currentlyOpenRowId && currentlyOpenRowId !== tx.id) closeCurrentlyOpenRow();
          currentlyOpenRowId = tx.id;
        }}
      >
        <TouchableOpacity
          style={[styles.txItem, { backgroundColor: colors.card, borderColor: colors.border }, isFirst && styles.txItemFirst, isLast && styles.txItemLast]}
          onPress={() => setSelectedTx(tx)}
          activeOpacity={1}
        >
          <View style={[styles.txIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="receipt" size={18} color={colors.primary} />
          </View>
          <View style={styles.txInfo}>
            <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
            <Text style={[styles.txMetaText, { color: colors.mutedForeground }]}>{formatDateShort(tx.date)} • {account?.name}</Text>
          </View>
          <Text style={[styles.txAmount, { color: isReceita ? colors.success : colors.destructive }]}>
            {isReceita ? '+' : '-'}{formatCurrency(tx.amount)}
          </Text>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading) return <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}><ActivityIndicator size='large' color={colors.primary} /></View>;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FlatList
        data={paginatedTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        onEndReached={handleLoadMore}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name='calendar-outline' size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum lançamento em {MONTHS[currentDate.getMonth()]}</Text>
          </View>
        }
      />

      <TransactionDetailModal transaction={isEditing ? null : selectedTx} onClose={() => setSelectedTx(null)} onEdit={() => setIsEditing(true)} />
      {isEditing && selectedTx && (
        <AddTransactionModal visible={isEditing} onClose={() => { setIsEditing(false); setSelectedTx(null); }} onAdd={addTransaction} onUpdate={updateTransaction} accounts={accounts} transactionToEdit={selectedTx} />
      )}

      {/* Modal de Filtros (Simplificado sem o switch de previstos) */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType='slide'
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View
            style={[
              styles.filterModalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.filterModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Filtros
              </Text>
              <TouchableOpacity
                onPress={() => setIsFilterModalOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.background }]}
              >
                <Ionicons name='close' size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }}>

              {/* FILTRO POR TIPO */}
              <Text style={[styles.filterGroupLabel, { color: colors.mutedForeground }]}>
                Tipo
              </Text>
              <View style={styles.chipRow}>
                {(['todas', 'receita', 'despesa', 'transferencia'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: filterType === t ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => setFilterType(t)}
                  >
                    <Text style={[styles.chipText, { color: filterType === t ? '#FFF' : colors.foreground }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* FILTRO POR CONTA (O que estava faltando) */}
              <Text style={[styles.filterGroupLabel, { color: colors.mutedForeground, marginTop: 20 }]}>
                Contas
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor: filterAccountId === 'todas' ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => setFilterAccountId('todas')}
                >
                  <Text style={[styles.chipText, { color: filterAccountId === 'todas' ? '#FFF' : colors.foreground }]}>
                    Todas
                  </Text>
                </TouchableOpacity>
                {accounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.chip,
                      {
                        borderColor: acc.color,
                        backgroundColor: filterAccountId === acc.id ? acc.color : 'transparent',
                      },
                    ]}
                    onPress={() => setFilterAccountId(acc.id)}
                  >
                    <Text style={[styles.chipText, { color: filterAccountId === acc.id ? '#FFF' : acc.color }]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 30 }} />
            </ScrollView>

            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.foreground }]}
              onPress={() => setIsFilterModalOpen(false)}
            >
              <Text style={[styles.applyBtnText, { color: colors.background }]}>
                Aplicar Filtros
              </Text>
            </TouchableOpacity>

            {activeFiltersCount > 0 && (
              <TouchableOpacity onPress={clearFilters} style={{ marginTop: 15, alignItems: 'center' }}>
                <Text style={{ color: colors.destructive, fontWeight: '600' }}>Limpar Filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <RecurrenceActionModal visible={!!recurrenceDeleteData} actionType='delete' onClose={() => setRecurrenceDeleteData(null)} onSelect={(mode) => { if (recurrenceDeleteData) deleteTransaction(recurrenceDeleteData, mode); setRecurrenceDeleteData(null); }} />
      
      <ConfirmDeleteModal
        visible={!!simpleDeleteData}
        title="Excluir lançamento?"
        description={`Tem certeza que deseja excluir "${simpleDeleteData?.description}"? Esta ação não pode ser desfeita.`}
        onClose={() => setSimpleDeleteData(null)}
        onConfirm={() => {
          if (simpleDeleteData) {
            deleteTransaction(simpleDeleteData.id, 'single');
            setSimpleDeleteData(null);
          }
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  balanceCard: { borderRadius: 20, padding: 24, gap: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  balanceValue: { color: '#FFF', fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceStatText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  balanceDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Estilo do Navegador de Data
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  navArrow: { padding: 8 },
  dateLabelContainer: { alignItems: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  yearLabel: { fontSize: 12, fontWeight: '500' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  filterBtn: { padding: 8, borderRadius: 12, borderWidth: 1, position: 'relative' },
  filterBadge: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  accountsRow: { flexDirection: 'row', gap: 12 },
  accountCard: { width: 140, borderRadius: 20, padding: 16, borderWidth: StyleSheet.hairlineWidth, minHeight: 110 },
  accountIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  accountTextContainer: { gap: 2 },
  accountName: { fontSize: 12, fontWeight: '500' },
  accountBalance: { fontSize: 16, fontWeight: '700' },
  secondaryText: { fontSize: 10, marginTop: 2 },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  txItemFirst: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  txItemLast: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20, borderBottomWidth: 0 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600' },
  txMetaText: { fontSize: 12 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: 40, gap: 8, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, marginTop: 20 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600'
  },
  applyBtn: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '700'
  },
  hiddenAction: { justifyContent: 'center', alignItems: 'center', width: 80 },
  hiddenActionRight: { borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  hiddenActionText: { color: '#FFF', fontSize: 10, fontWeight: '700', marginTop: 4 }
});