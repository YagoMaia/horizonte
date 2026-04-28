// components/screens/SaldosScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
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
    showPending,
    setShowPending,
  } = useStoreContext();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [recurrenceDeleteData, setRecurrenceDeleteData] = useState<
    string | null
  >(null);

  // 👉 1. NOVOS ESTADOS PARA OS FILTROS
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | 'todas'>(
    'todas',
  );
  const [filterAccountId, setFilterAccountId] = useState<string | 'todas'>(
    'todas',
  );
  const [filterTagId, setFilterTagId] = useState<string | 'todas'>('todas');

  // Conta quantos filtros estão ativos (para a bolinha vermelha no ícone)
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

  // 👉 2. O MOTOR DE BUSCA (A LÓGICA DO FILTRO MULTI-CRITÉRIOS)
  const displayedTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Regra 1: Ocultar previstos se o switch estiver desligado
        if (!showPending && !tx.paid) return false;

        // Regra 2: Filtro de Tipo (Receita, Despesa, Transferência)
        if (filterType !== 'todas' && tx.type !== filterType) return false;

        // Regra 3: Filtro de Conta (O pulo do gato: procura na origem E no destino)
        if (filterAccountId !== 'todas') {
          if (
            tx.accountId !== filterAccountId &&
            tx.targetAccountId !== filterAccountId
          ) {
            return false;
          }
        }

        // Regra 4: Filtro de Tag
        if (filterTagId !== 'todas' && !tx.tagIds.includes(filterTagId))
          return false;

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, showPending, filterType, filterAccountId, filterTagId]);

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
  }, [showPending, filterType, filterAccountId, filterTagId]);

  const clearFilters = () => {
    setFilterType('todas');
    setFilterAccountId('todas');
    setFilterTagId('todas');
  };

  // Funções de Swipe (Mantidas)
  const handleTogglePaid = (tx: Transaction) => {
    closeCurrentlyOpenRow();
    updateTransaction({ ...tx, paid: !tx.paid });
  };

  const handleDeletePrompt = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    const isFamily = tx.groupId || tx.id.includes('-');

    if (isFamily) {
      // 👉 Se tem família, abre o Bottom Sheet Customizado
      closeCurrentlyOpenRow();
      setRecurrenceDeleteData(txId);
    } else {
      // 👉 Se for órfã, usa o Alert padrão do sistema
      Alert.alert(
        'Apagar Lançamento',
        'Tem certeza que deseja excluir esta transação?',
        [
          { text: 'Cancelar', style: 'cancel', onPress: closeCurrentlyOpenRow },
          {
            text: 'Apagar',
            style: 'destructive',
            onPress: () => {
              closeCurrentlyOpenRow();
              deleteTransaction(txId, 'single');
            },
          },
        ],
      );
    }
  };

  const renderLeftActions = (tx: Transaction) => {
    const isPaid = tx.paid;
    const actionColor = isPaid ? colors.warning : colors.success;
    const actionIcon = isPaid ? 'time-outline' : 'checkmark-circle-outline';
    const actionLabel = isPaid ? 'Tornar\nPendente' : 'Marcar\nPago';
    return (
      <TouchableOpacity
        style={[
          styles.hiddenAction,
          styles.hiddenActionLeft,
          { backgroundColor: actionColor },
        ]}
        onPress={() => handleTogglePaid(tx)}
      >
        <Ionicons name={actionIcon} size={24} color='#FFF' />
        <Text style={styles.hiddenActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    );
  };

  const renderRightActions = (txId: string) => {
    return (
      <TouchableOpacity
        style={[
          styles.hiddenAction,
          styles.hiddenActionRight,
          { backgroundColor: colors.destructive },
        ]}
        onPress={() => handleDeletePrompt(txId)}
      >
        <Ionicons name='trash-outline' size={24} color='#FFF' />
        <Text style={styles.hiddenActionText}>Apagar</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
        <Text style={styles.balanceLabel}>Saldo Total</Text>
        <Text style={styles.balanceValue}>{formatCurrency(totalBalance)}</Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceStat}>
            <Ionicons
              name='arrow-up-circle'
              size={16}
              color='rgba(255,255,255,0.8)'
            />
            <Text style={styles.balanceStatText}>
              {formatCurrency(monthlyIncome)}
            </Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceStat}>
            <Ionicons
              name='arrow-down-circle'
              size={16}
              color='rgba(255,255,255,0.8)'
            />
            <Text style={styles.balanceStatText}>
              {formatCurrency(monthlyExpense)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Contas e Cartões
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.accountsRow}>
          {accounts.map((acc: Account) => {
            const isCreditCard = acc.type === 'cartao_credito';
            let currentInvoice = 0;
            if (isCreditCard) {
              currentInvoice = calculateCreditCardInvoice(acc, transactions);
            }
            const cardLimit =
              acc.creditLimit || (acc.balance > 0 ? acc.balance : 0);
            const availableLimit = Math.max(0, cardLimit - currentInvoice);
            const mainDisplayValue = isCreditCard
              ? availableLimit
              : acc.balance;

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
                    {isCreditCard && cardLimit === 0
                      ? 'Lim. não definido'
                      : formatCurrency(mainDisplayValue)}
                  </Text>
                  {isCreditCard && (
                    <Text
                      style={[
                        styles.secondaryText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Fatura: {formatCurrency(currentInvoice)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Lançamentos
        </Text>

        {/* 👉 3. BOTÕES DE FILTRO NO CABEÇALHO */}
        <View style={styles.filterToggle}>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setIsFilterModalOpen(true)}
          >
            <Ionicons
              name='options-outline'
              size={18}
              color={colors.foreground}
            />
            {activeFiltersCount > 0 && (
              <View
                style={[
                  styles.filterBadge,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[styles.filterText, { color: colors.mutedForeground }]}
            >
              Previstos
            </Text>
            <Switch
              value={showPending}
              onValueChange={setShowPending}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor='#ffffff'
              style={{ transform: [{ scale: 0.8 }] }}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderItem = ({
    item: tx,
    index,
  }: {
    item: Transaction;
    index: number;
  }) => {
    const isFirst = index === 0;
    const isLast = index === paginatedTransactions.length - 1;
    const isReceita = tx.type === 'receita';
    const isCredito = tx.paymentMethod === 'credito';
    const amountColor = isReceita
      ? colors.success
      : tx.type === 'transferencia'
        ? colors.primary
        : colors.destructive;

    const tag =
      tx.tagIds?.length > 0 ? tags.find((t) => t.id === tx.tagIds[0]) : null;
    const account = accounts.find((a) => a.id === tx.accountId);
    const targetAccount =
      tx.type === 'transferencia'
        ? accounts.find((a) => a.id === tx.targetAccountId)
        : null;

    const iconColor = tag
      ? tag.color
      : isReceita
        ? colors.success
        : tx.type === 'transferencia'
          ? colors.primary
          : colors.destructive;
    const iconName = tag
      ? tag.icon
      : isReceita
        ? 'arrow-up'
        : tx.type === 'transferencia'
          ? 'swap-horizontal'
          : 'arrow-down';

    const ItemContent = () => (
      <TouchableOpacity
        style={[
          styles.txItem,
          { backgroundColor: colors.card, borderColor: colors.border },
          isFirst && styles.txItemFirst,
          isLast && styles.txItemLast,
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth },
        ]}
        onPress={() => setSelectedTx(tx)}
        activeOpacity={1}
      >
        <View style={[styles.txIcon, { backgroundColor: iconColor + '15' }]}>
          <Ionicons name={iconName as any} size={18} color={iconColor} />
        </View>

        <View style={styles.txInfo}>
          <Text
            style={[styles.txDesc, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {tx.description}
          </Text>
          <View style={styles.txMeta}>
            <Text style={[styles.txDateText, { color: colors.primary }]}>
              {formatDateShort(tx.date)}
            </Text>
            <View style={[styles.txDot, { backgroundColor: colors.border }]} />
            <Text
              style={[styles.txMetaText, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {tag?.name || 'Sem categoria'}
            </Text>
            <View style={[styles.txDot, { backgroundColor: colors.border }]} />
            <Text
              style={[styles.txMetaText, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {tx.type === 'transferencia' && targetAccount
                ? `${account?.name} ➔ ${targetAccount.name}`
                : account?.name || 'Conta externa'}
            </Text>
          </View>
        </View>

        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: amountColor }]}>
            {isReceita ? '+' : tx.type === 'transferencia' ? '' : '-'}
            {formatCurrency(tx.amount)}
          </Text>
          <View style={styles.badgesContainer}>
            {isCredito && (
              <View
                style={[
                  styles.smallBadge,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.smallBadgeText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  CRÉDITO
                </Text>
              </View>
            )}
            {!tx.paid && (
              <View
                style={[
                  styles.smallBadge,
                  { backgroundColor: colors.warningLight },
                ]}
              >
                <Text
                  style={[styles.smallBadgeText, { color: colors.warning }]}
                >
                  PREV
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) rowRefs.set(tx.id, ref);
        }}
        renderLeftActions={() => renderLeftActions(tx)}
        renderRightActions={() => renderRightActions(tx.id)}
        onSwipeableWillOpen={() => {
          if (currentlyOpenRowId && currentlyOpenRowId !== tx.id)
            closeCurrentlyOpenRow();
          currentlyOpenRowId = tx.id;
        }}
        onSwipeableWillClose={() => {
          if (currentlyOpenRowId === tx.id) currentlyOpenRowId = null;
        }}
        containerStyle={[
          isFirst && styles.txItemFirst,
          isLast && styles.txItemLast,
          { overflow: 'hidden' },
        ]}
      >
        <ItemContent />
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FlatList
        data={paginatedTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyState,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name='receipt-outline'
              size={40}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {activeFiltersCount > 0
                ? 'Nenhum lançamento encontrado para os filtros ativos.'
                : 'Nenhum lançamento'}
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity
                onPress={clearFilters}
                style={{ marginTop: 12 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  Limpar Filtros
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <TransactionDetailModal
        transaction={isEditing ? null : selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={() => setIsEditing(true)}
      />

      {isEditing && selectedTx && (
        <AddTransactionModal
          visible={isEditing}
          onClose={() => {
            setIsEditing(false);
            setSelectedTx(null);
          }}
          onAdd={addTransaction}
          onUpdate={updateTransaction}
          accounts={accounts}
          tags={tags}
          transactionToEdit={selectedTx}
        />
      )}

      {/* 👉 4. MODAL DE FILTROS */}
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
                Filtros Avançados
              </Text>
              <TouchableOpacity
                onPress={() => setIsFilterModalOpen(false)}
                style={[
                  styles.closeBtn,
                  { backgroundColor: colors.background },
                ]}
              >
                <Ionicons name='close' size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: '80%' }}
            >
              {/* TIPO */}
              <Text
                style={[
                  styles.filterGroupLabel,
                  { color: colors.mutedForeground },
                ]}
              >
                Tipo de Transação
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor:
                        filterType === 'todas' ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => setFilterType('todas')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          filterType === 'todas' ? '#FFF' : colors.foreground,
                      },
                    ]}
                  >
                    Todas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor:
                        filterType === 'receita'
                          ? colors.success
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setFilterType('receita')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          filterType === 'receita' ? '#FFF' : colors.foreground,
                      },
                    ]}
                  >
                    Receitas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor:
                        filterType === 'despesa'
                          ? colors.destructive
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setFilterType('despesa')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          filterType === 'despesa' ? '#FFF' : colors.foreground,
                      },
                    ]}
                  >
                    Despesas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor:
                        filterType === 'transferencia'
                          ? colors.primary
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setFilterType('transferencia')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          filterType === 'transferencia'
                            ? '#FFF'
                            : colors.foreground,
                      },
                    ]}
                  >
                    Transferências
                  </Text>
                </TouchableOpacity>
              </View>

              {/* CONTA */}
              <Text
                style={[
                  styles.filterGroupLabel,
                  { color: colors.mutedForeground, marginTop: 24 },
                ]}
              >
                Conta de Origem/Destino
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor:
                        filterAccountId === 'todas'
                          ? colors.primary
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setFilterAccountId('todas')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          filterAccountId === 'todas'
                            ? '#FFF'
                            : colors.foreground,
                      },
                    ]}
                  >
                    Todas as Contas
                  </Text>
                </TouchableOpacity>
                {accounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.chip,
                      {
                        borderColor: acc.color,
                        backgroundColor:
                          filterAccountId === acc.id
                            ? acc.color
                            : 'transparent',
                      },
                    ]}
                    onPress={() => setFilterAccountId(acc.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color:
                            filterAccountId === acc.id ? '#FFF' : acc.color,
                        },
                      ]}
                    >
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* TAGS */}
              <Text
                style={[
                  styles.filterGroupLabel,
                  { color: colors.mutedForeground, marginTop: 24 },
                ]}
              >
                Categoria (Tag)
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor:
                        filterTagId === 'todas'
                          ? colors.primary
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setFilterTagId('todas')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          filterTagId === 'todas' ? '#FFF' : colors.foreground,
                      },
                    ]}
                  >
                    Todas as Categorias
                  </Text>
                </TouchableOpacity>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.chip,
                      {
                        borderColor: tag.color,
                        backgroundColor:
                          filterTagId === tag.id ? tag.color : 'transparent',
                      },
                    ]}
                    onPress={() => setFilterTagId(tag.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: filterTagId === tag.id ? '#FFF' : tag.color },
                      ]}
                    >
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

            {/* BOTÃO LIMPAR FILTROS (Só aparece se algo estiver filtrado) */}
            {activeFiltersCount > 0 && (
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={clearFilters}
              >
                <Ionicons
                  name='trash-outline'
                  size={18}
                  color={colors.destructive}
                />
                <Text style={{ color: colors.destructive, fontWeight: '600' }}>
                  Limpar {activeFiltersCount} filtro(s) ativo(s)
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.foreground }]}
              onPress={() => setIsFilterModalOpen(false)}
            >
              <Text style={[styles.applyBtnText, { color: colors.background }]}>
                Ver Resultados
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <RecurrenceActionModal
        visible={!!recurrenceDeleteData}
        actionType='delete'
        onClose={() => setRecurrenceDeleteData(null)}
        onSelect={(mode) => {
          if (recurrenceDeleteData) {
            deleteTransaction(recurrenceDeleteData, mode);
          }
          setRecurrenceDeleteData(null);
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  balanceCard: { borderRadius: 20, padding: 24, gap: 4 },
  balanceLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
  balanceValue: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceStatText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  balanceDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },

  // 👉 ESTILOS DOS BOTÕES DE FILTRO NO HEADER
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterBtn: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  filterText: { fontSize: 13, fontWeight: '500' },

  sectionTitle: { fontSize: 16, fontWeight: '600' },
  accountsRow: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  accountCard: {
    width: 140,
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
    minHeight: 120,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  accountTextContainer: { gap: 2 },
  accountName: { fontSize: 13, fontWeight: '500' },
  accountBalance: { fontSize: 18, fontWeight: '600', letterSpacing: -0.5 },
  secondaryText: { fontSize: 11, fontWeight: '400', marginTop: 2 },

  emptyState: {
    alignItems: 'center',
    padding: 40,
    gap: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },

  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  txItemFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  txItemLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: { flex: 1, gap: 4 },
  txDesc: { fontSize: 15, fontWeight: '600' },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  txDateText: { fontSize: 12, fontWeight: '700' },
  txMetaText: { fontSize: 12, fontWeight: '400' },
  txDot: { width: 3, height: 3, borderRadius: 1.5 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  badgesContainer: { flexDirection: 'row', gap: 4 },
  smallBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  smallBadgeText: { fontSize: 9, fontWeight: '800' },

  hiddenAction: { justifyContent: 'center', alignItems: 'center', width: 80 },
  hiddenActionLeft: { borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  hiddenActionRight: { borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  hiddenActionText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // 👉 ESTILOS DO MODAL DE FILTRO
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
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterGroupLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 12,
  },
  applyBtn: { padding: 16, borderRadius: 16, alignItems: 'center' },
  applyBtnText: { fontSize: 16, fontWeight: '700' },
});