// components/screens/SaldosScreen.tsx
import React, { useMemo, useState, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/hooks/useTheme';
import {
  calculateCreditCardInvoice,
  formatCurrency,
  formatDateShort,
  getTransactionVisuals,
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
import { SearchBar } from '../SearchBar';
import { useTransactionSearch } from '@/hooks/useTransactionSearch';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';

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
  const { goals, addDeposit, deposits, deleteDeposit } = useSavingsGoals();
  const insets = useSafeAreaInsets();

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [recurrenceDeleteData, setRecurrenceDeleteData] = useState<string | null>(null);
  const [simpleDeleteData, setSimpleDeleteData] = useState<Transaction | null>(null);
  
  const overduePendingTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return transactions.filter(tx => 
      !tx.paid && 
      new Date(tx.date) <= today && 
      tx.reminderEnabled
    );
  }, [transactions]);

  // ESTADOS PARA FILTROS
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | 'todas'>('todas');
  const [filterAccountId, setFilterAccountId] = useState<string | 'todas'>('todas');

  // ESTADOS PARA NAVEGAÇÃO DE DATA
  const [currentDate, setCurrentDate] = useState(new Date());

  // SEARCH HOOK
  const {
    searchTerm,
    setSearchTerm,
    clearSearch,
    isSearchActive,
    displayedResults,
    loadMore: searchLoadMore,
    hasMore: searchHasMore,
  } = useTransactionSearch(transactions, { type: filterType, accountId: filterAccountId });

  const activeFiltersCount =
    (filterType !== 'todas' ? 1 : 0) +
    (filterAccountId !== 'todas' ? 1 : 0);

  const rowRefs = React.useRef(new Map()).current;
  const currentlyOpenRowRef = useRef<string | null>(null);

  const closeCurrentlyOpenRow = () => {
    if (currentlyOpenRowRef.current && rowRefs.get(currentlyOpenRowRef.current)) {
      rowRefs.get(currentlyOpenRowRef.current).close();
    }
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  // CÁLCULO DE ENTRADAS E SAÍDAS DO MÊS ATUAL
  const currentMonthStats = useMemo(() => {
    let income = 0;
    let expenseDebit = 0;
    let expenseCredit = 0;

    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      // Filtra pelo mês atual
      if (
        txDate.getMonth() === currentDate.getMonth() &&
        txDate.getFullYear() === currentDate.getFullYear()
      ) {
        if (tx.type === 'receita' && tx.paid) {
          income += tx.amount;
        } else if (tx.type === 'despesa') {
          if (tx.paymentMethod === 'credito') {
            // Conta TODAS as compras de crédito do mês (não há transações virtuais de fatura aqui)
            expenseCredit += tx.amount;
          } else if (tx.paid) {
            // Débito só conta se estiver pago
            expenseDebit += tx.amount;
          }
        }
      }
    });

    return { income, expense: expenseDebit + expenseCredit, expenseDebit, expenseCredit };
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

  const [exportModalVisible, setExportModalVisible] = useState(false);

  const getMonthExportData = () => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

    const monthTransactions = transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d >= monthStart && d <= monthEnd;
    });

    const receitas = monthTransactions.filter(t => t.type === 'receita');
    const despesas = monthTransactions.filter(t => t.type === 'despesa');
    const transferencias = monthTransactions.filter(t => t.type === 'transferencia');

    const receitasPagas = receitas.filter(t => t.paid);
    const despesasPagas = despesas.filter(t => t.paid);
    const despesasCredito = despesas.filter(t => t.paymentMethod === 'credito');
    const despesasDebito = despesas.filter(t => t.paymentMethod !== 'credito' && t.paid);

    const resolveAccountName = (accountId: string) =>
      accounts.find(a => a.id === accountId)?.name ?? 'Conta removida';

    return {
      monthStart, monthEnd, monthTransactions,
      receitas, despesas, transferencias,
      receitasPagas, despesasPagas, despesasCredito, despesasDebito,
      resolveAccountName,
    };
  };

  const exportAsJson = async () => {
    setExportModalVisible(false);
    try {
      const { monthStart, monthEnd, receitas, despesas, transferencias, receitasPagas, despesasPagas, despesasCredito, despesasDebito, resolveAccountName, monthTransactions } = getMonthExportData();

      const mapTx = (tx: Transaction) => ({
        descricao: tx.description,
        valor: tx.amount,
        data: tx.date,
        conta: resolveAccountName(tx.accountId),
        pago: tx.paid,
        metodo: tx.paymentMethod || 'debito',
      });

      const exportData = {
        mes: MONTHS[currentDate.getMonth()],
        ano: currentDate.getFullYear(),
        periodo: {
          inicio: monthStart.toISOString().split('T')[0],
          fim: monthEnd.toISOString().split('T')[0],
        },
        resumo: {
          totalReceitas: receitasPagas.reduce((s, t) => s + t.amount, 0),
          totalDespesasDebito: despesasDebito.reduce((s, t) => s + t.amount, 0),
          totalDespesasCredito: despesasCredito.reduce((s, t) => s + t.amount, 0),
          totalTransferencias: transferencias.reduce((s, t) => s + t.amount, 0),
          saldoLiquido: receitasPagas.reduce((s, t) => s + t.amount, 0) - despesasPagas.reduce((s, t) => s + t.amount, 0),
          totalTransacoes: monthTransactions.length,
        },
        transacoes: {
          receitas: receitas.map(mapTx),
          despesas: despesas.map(mapTx),
          transferencias: transferencias.map((tx) => ({
            ...mapTx(tx),
            contaDestino: tx.targetAccountId ? resolveAccountName(tx.targetAccountId) : 'N/A',
          })),
        },
      };

      const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
      const fileName = `extrato-${currentDate.getFullYear()}-${monthStr}.json`;
      const content = JSON.stringify(exportData, null, 2);

      await shareFile(fileName, content, 'application/json');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar os dados.');
    }
  };

  const exportAsCsv = async () => {
    setExportModalVisible(false);
    try {
      const { monthTransactions, resolveAccountName } = getMonthExportData();

      const header = 'Data;Descrição;Tipo;Valor;Conta;Conta Destino;Pago;Método\n';
      const rows = monthTransactions
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((tx) => {
          const data = tx.date.split('T')[0];
          const desc = tx.description.replace(/;/g, ',');
          const tipo = tx.type;
          const valor = tx.amount.toFixed(2).replace('.', ',');
          const conta = resolveAccountName(tx.accountId);
          const contaDestino = tx.type === 'transferencia' && tx.targetAccountId
            ? resolveAccountName(tx.targetAccountId) : '';
          const pago = tx.paid ? 'Sim' : 'Não';
          const metodo = tx.paymentMethod || 'debito';
          return `${data};${desc};${tipo};${valor};${conta};${contaDestino};${pago};${metodo}`;
        })
        .join('\n');

      const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
      const fileName = `extrato-${currentDate.getFullYear()}-${monthStr}.csv`;
      const content = header + rows;

      await shareFile(fileName, content, 'text/csv');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar os dados.');
    }
  };

  const shareFile = async (fileName: string, content: string, mimeType: string) => {
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, content);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, { mimeType, dialogTitle: 'Exportar Extrato' });
      } else {
        Alert.alert('Exportado', `Arquivo salvo em: ${filePath}`);
      }
    }
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name='arrow-down-circle' size={16} color='rgba(255,255,255,0.8)' />
              <Text style={styles.balanceStatText}>{formatCurrency(currentMonthStats.expense)}</Text>
            </View>
            {(currentMonthStats.expenseCredit > 0 || currentMonthStats.expenseDebit > 0) && (
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {currentMonthStats.expenseDebit > 0 ? `Déb.: ${formatCurrency(currentMonthStats.expenseDebit)}` : ''}
                {currentMonthStats.expenseDebit > 0 && currentMonthStats.expenseCredit > 0 ? ' | ' : ''}
                {currentMonthStats.expenseCredit > 0 ? `Créd.: ${formatCurrency(currentMonthStats.expenseCredit)}` : ''}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* BANNER DE PENDÊNCIAS */}
      {overduePendingTransactions.length > 0 && (
        <View style={[styles.pendingBanner, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.pendingTitle, { color: colors.warning }]}>Lançamentos Atrasados</Text>
            <Text style={[styles.pendingText, { color: colors.foreground }]}>
              Você tem {overduePendingTransactions.length} {overduePendingTransactions.length === 1 ? 'pagamento que não foi confirmado' : 'pagamentos que não foram confirmados'}:
            </Text>
            <View style={{ marginTop: 2 }}>
              {overduePendingTransactions.slice(0, 2).map((tx) => (
                <Text key={tx.id} style={{ fontSize: 12, color: colors.foreground, marginLeft: 4 }}>
                  • {tx.description} ({formatCurrency(tx.amount)})
                </Text>
              ))}
              {overduePendingTransactions.length > 2 && (
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginLeft: 4, marginTop: 2, fontStyle: 'italic' }}>
                  E mais {overduePendingTransactions.length - 2} {overduePendingTransactions.length - 2 === 1 ? 'lançamento' : 'lançamentos'}...
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setExportModalVisible(true)}
          >
            <Ionicons name='download-outline' size={18} color={colors.foreground} />
          </TouchableOpacity>
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
      </View>

      {/* 4. BARRA DE NAVEGAÇÃO DOS MESES (Agora abaixo do botão de filtros) */}
      {isSearchActive ? (
        <View style={[styles.searchModeLabel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <Text style={[styles.searchModeLabelText, { color: colors.foreground }]}>
            Resultados da busca
          </Text>
        </View>
      ) : (
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
      )}
    </View>
  );

  // Determine which data source to use based on search state
  const listData = isSearchActive ? displayedResults : paginatedTransactions;

  const renderItem = ({ item: tx, index }: { item: Transaction; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === listData.length - 1;
    let sourceName = '';
    const account = accounts.find((a) => a.id === tx.accountId);
    if (account) {
      sourceName = account.name;
    } else if (tx.accountId?.startsWith('goal_')) {
      const goalId = tx.accountId.replace('goal_', '');
      const goal = goals.find((g) => g.id === goalId);
      sourceName = goal ? `Meta: ${goal.name}` : 'Meta';
    }
    
    const visuals = getTransactionVisuals(tx.type, colors);

    let destName = '';
    if (tx.type === 'transferencia' && tx.targetAccountId) {
      if (tx.targetAccountId.startsWith('goal_')) {
        const goalId = tx.targetAccountId.replace('goal_', '');
        const goal = goals.find((g) => g.id === goalId);
        destName = goal ? `Meta: ${goal.name}` : 'Meta';
      } else {
        const destAcc = accounts.find((a) => a.id === tx.targetAccountId);
        destName = destAcc ? destAcc.name : 'Conta';
      }
    }

    return (
      <Swipeable
        ref={(ref) => { if (ref) rowRefs.set(tx.id, ref); }}
        renderRightActions={() => renderRightActions(tx.id)}
        onSwipeableWillOpen={() => {
          if (currentlyOpenRowRef.current && currentlyOpenRowRef.current !== tx.id) closeCurrentlyOpenRow();
          currentlyOpenRowRef.current = tx.id;
        }}
      >
        <TouchableOpacity
          style={[styles.txItem, { backgroundColor: colors.card, borderColor: colors.border }, isFirst && styles.txItemFirst, isLast && styles.txItemLast]}
          onPress={() => setSelectedTx(tx)}
          activeOpacity={1}
        >
          <View style={[styles.txIcon, { backgroundColor: visuals.bgColor }]}>
            <Ionicons name={visuals.icon as any} size={20} color={visuals.color} />
          </View>
          <View style={styles.txInfo}>
            <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
            <Text style={[styles.txMetaText, { color: colors.mutedForeground }]}>
              {formatDateShort(tx.date)} • {sourceName}
              {destName ? ` ➔ ${destName}` : ''}
            </Text>
          </View>
          <Text style={[styles.txAmount, { color: visuals.color }]}>
            {visuals.prefix}{formatCurrency(tx.amount)}
          </Text>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading) return <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}><ActivityIndicator size='large' color={colors.primary} /></View>;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* SEARCH BAR - Outside FlatList to prevent keyboard dismissal on re-render */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <SearchBar
            value={searchTerm}
            onChangeText={setSearchTerm}
            onClear={clearSearch}
          />
        </View>

        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          onEndReached={isSearchActive ? searchLoadMore : handleLoadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={false}
          getItemLayout={(_, index) => ({
            length: 72, 
            offset: 72 * index,
            index,
          })}
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name={isSearchActive ? 'search-outline' : 'calendar-outline'} size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isSearchActive ? 'Nenhuma transação encontrada' : `Nenhum lançamento em ${MONTHS[currentDate.getMonth()]}`}
              </Text>
            </View>
          }
        />
      </View>

      <TransactionDetailModal transaction={isEditing ? null : selectedTx} onClose={() => setSelectedTx(null)} onEdit={() => setIsEditing(true)} goals={goals} />
      {isEditing && selectedTx && (
        <AddTransactionModal 
          visible={isEditing} 
          onClose={() => { setIsEditing(false); setSelectedTx(null); }} 
          onAdd={async (tx) => {
            await addTransaction(tx);
            if (tx.type === 'transferencia' && tx.targetAccountId?.startsWith('goal_')) {
              const goalId = tx.targetAccountId.replace('goal_', '');
              await addDeposit(goalId, tx.amount, tx.accountId);
            }
          }} 
          onUpdate={updateTransaction} 
          accounts={accounts} 
          transactionToEdit={selectedTx} 
          goals={goals} 
        />
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
        onConfirm={async () => {
          if (simpleDeleteData) {
            // Se for uma transferência para uma meta, tenta excluir o depósito correspondente
            if (simpleDeleteData.type === 'transferencia' && simpleDeleteData.targetAccountId?.startsWith('goal_')) {
              const goalId = simpleDeleteData.targetAccountId.replace('goal_', '');
              // Encontra um depósito na meta com o mesmo valor e conta origem (usando a aproximação como heurística)
              const matchingDeposit = deposits.find(
                (d) => d.goalId === goalId && d.amount === simpleDeleteData.amount && d.accountId === simpleDeleteData.accountId
              );
              if (matchingDeposit) {
                try {
                  await deleteDeposit(matchingDeposit.id);
                  console.log('[DEBUG] SaldosScreen auto-deleted matching deposit', matchingDeposit.id);
                } catch (e) {
                  console.error('[DEBUG] Failed to delete matching deposit', e);
                }
              }
            }
            deleteTransaction(simpleDeleteData.id, 'single');
            setSimpleDeleteData(null);
          }
        }}
      />

      {/* Modal de Exportação */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType='fade'
        onRequestClose={() => setExportModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.exportOverlay}
          activeOpacity={1}
          onPress={() => setExportModalVisible(false)}
        >
          <View style={[styles.exportModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.exportTitle, { color: colors.foreground }]}>
              Exportar {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </Text>
            <Text style={[styles.exportSubtitle, { color: colors.mutedForeground }]}>
              Escolha o formato de exportação
            </Text>

            <TouchableOpacity
              style={[styles.exportOption, { borderColor: colors.border }]}
              onPress={exportAsCsv}
            >
              <View style={[styles.exportOptionIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="grid-outline" size={22} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportOptionTitle, { color: colors.foreground }]}>CSV</Text>
                <Text style={[styles.exportOptionDesc, { color: colors.mutedForeground }]}>
                  Para Excel e Google Sheets
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportOption, { borderColor: colors.border }]}
              onPress={exportAsJson}
            >
              <View style={[styles.exportOptionIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="code-slash-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportOptionTitle, { color: colors.foreground }]}>JSON</Text>
                <Text style={[styles.exportOptionDesc, { color: colors.mutedForeground }]}>
                  Para análise com Python ou programação
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  hiddenActionText: { color: '#FFF', fontSize: 10, fontWeight: '700', marginTop: 4 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  pendingText: {
    fontSize: 12,
    lineHeight: 16,
  },
  searchModeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchModeLabelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  exportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  exportModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  exportSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  exportOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  exportOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  });