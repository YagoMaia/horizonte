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

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function SaldosScreen() {
  const { colors } = useTheme();
  const {
    accounts,
    tags,
    transactions,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    loading,
  } = useStoreContext();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [recurrenceDeleteData, setRecurrenceDeleteData] = useState<string | null>(null);

  // ESTADOS PARA FILTROS
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | 'todas'>('todas');
  const [filterAccountId, setFilterAccountId] = useState<string | 'todas'>('todas');
  const [filterTagId, setFilterTagId] = useState<string | 'todas'>('todas');

  // ESTADOS PARA NAVEGAÇÃO DE DATA
  const [currentDate, setCurrentDate] = useState(new Date());

  const activeFiltersCount =
    (filterType !== 'todas' ? 1 : 0) +
    (filterAccountId !== 'todas' ? 1 : 0) +
    (filterTagId !== 'todas' ? 1 : 0);

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

  // MOTOR DE BUSCA ATUALIZADO (Filtro por Mês + Categorias)
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

        // Regra 4: Filtro de Tag
        if (filterTagId !== 'todas' && !tx.tagIds.includes(filterTagId)) return false;

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentDate, filterType, filterAccountId, filterTagId]);

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
  }, [currentDate, filterType, filterAccountId, filterTagId]);

  const clearFilters = () => {
    setFilterType('todas');
    setFilterAccountId('todas');
    setFilterTagId('todas');
  };

  const handleDeletePrompt = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;
    const isFamily = tx.groupId || tx.id.includes('-');
    if (isFamily) {
      closeCurrentlyOpenRow();
      setRecurrenceDeleteData(txId);
    } else {
      Alert.alert('Apagar Lançamento', 'Tem certeza que deseja excluir esta transação?', [
        { text: 'Cancelar', style: 'cancel', onPress: closeCurrentlyOpenRow },
        { text: 'Apagar', style: 'destructive', onPress: () => { closeCurrentlyOpenRow(); deleteTransaction(txId, 'single'); } },
      ]);
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
            <Text style={styles.balanceStatText}>{formatCurrency(monthlyIncome)}</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceStat}>
            <Ionicons name='arrow-down-circle' size={16} color='rgba(255,255,255,0.8)' />
            <Text style={styles.balanceStatText}>{formatCurrency(monthlyExpense)}</Text>
          </View>
        </View>
      </View>

      {/* 2. SEÇÃO DE CONTAS E CARTÕES */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contas e Cartões</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.accountsRow}>
          {accounts.map((acc: Account) => {
            const isCreditCard = acc.type === 'cartao_credito';
            const currentInvoice = isCreditCard ? calculateCreditCardInvoice(acc, transactions) : 0;
            const cardLimit = acc.creditLimit || (acc.balance > 0 ? acc.balance : 0);
            const mainDisplayValue = isCreditCard ? Math.max(0, cardLimit - currentInvoice) : acc.balance;

            return (
              <View key={acc.id} style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.accountIcon, { backgroundColor: acc.color + '15' }]}>
                  <Ionicons name={acc.icon as any} size={18} color={acc.color} />
                </View>
                <View style={styles.accountTextContainer}>
                  <Text style={[styles.accountName, { color: colors.mutedForeground }]} numberOfLines={1}>{acc.name}</Text>
                  <Text style={[styles.accountBalance, { color: colors.foreground }]}>{formatCurrency(mainDisplayValue)}</Text>
                  {isCreditCard && <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>Fatura: {formatCurrency(currentInvoice)}</Text>}
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
    const tag = tx.tagIds?.length > 0 ? tags.find((t) => t.id === tx.tagIds[0]) : null;
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
          <View style={[styles.txIcon, { backgroundColor: (tag?.color || colors.primary) + '15' }]}>
            <Ionicons name={(tag?.icon || 'receipt') as any} size={18} color={tag?.color || colors.primary} />
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
        <AddTransactionModal visible={isEditing} onClose={() => { setIsEditing(false); setSelectedTx(null); }} onAdd={addTransaction} onUpdate={updateTransaction} accounts={accounts} tags={tags} transactionToEdit={selectedTx} />
      )}

      {/* Modal de Filtros (Simplificado sem o switch de previstos) */}
      <Modal visible={isFilterModalOpen} transparent animationType='slide'>
        <View style={styles.modalOverlayBottom}>
          <View style={[styles.filterModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 20 }]}>Filtrar por Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={styles.chipRow}>
                {tags.map(tag => (
                  <TouchableOpacity key={tag.id} style={[styles.chip, { borderColor: tag.color, backgroundColor: filterTagId === tag.id ? tag.color : 'transparent' }]} onPress={() => setFilterTagId(tag.id)}>
                    <Text style={[styles.chipText, { color: filterTagId === tag.id ? '#FFF' : tag.color }]}>{tag.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={() => setIsFilterModalOpen(false)}>
              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Aplicar Filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearFilters} style={{ marginTop: 15, alignItems: 'center' }}>
              <Text style={{ color: colors.destructive }}>Limpar Tudo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <RecurrenceActionModal visible={!!recurrenceDeleteData} actionType='delete' onClose={() => setRecurrenceDeleteData(null)} onSelect={(mode) => { if (recurrenceDeleteData) deleteTransaction(recurrenceDeleteData, mode); setRecurrenceDeleteData(null); }} />
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
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  filterModalContent: { padding: 24, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  applyBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  hiddenAction: { justifyContent: 'center', alignItems: 'center', width: 80 },
  hiddenActionRight: { borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  hiddenActionText: { color: '#FFF', fontSize: 10, fontWeight: '700', marginTop: 4 }
});