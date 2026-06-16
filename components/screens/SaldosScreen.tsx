// components/screens/SaldosScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Alert,
  Modal,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import {
  formatCurrency,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formatDateShort,
  getCurrentOpenInvoiceTotal,
} from '@/lib/utils';
import { useStoreContext } from '@/context/StoreContext';
import { Transaction, Account, TransactionType, Project } from '@/constants/types';
import { ProjectTransactionsModal } from '../ProjectTransactionsModal';
import { RecurrenceActionModal } from '../RecurrenceActionModal';
import { TransactionItem } from '../TransactionItem';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function SaldosScreen() {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const {
    accounts,
    transactions,
    tags,
    projects,
    goals,
    getProjectSpent,
    getGoalSavedAmount,
    totalBalance,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addTransaction,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateTransaction,
    deleteTransaction,
    loading,
    homeLayout,
  } = useStoreContext();

  // --- ESTADOS ---
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<Project | null>(null);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [recurrenceDeleteData, setRecurrenceDeleteData] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | 'todas'>('todas');
  const [filterAccountId, setFilterAccountId] = useState<string | 'todas'>('todas');
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- REFS ---
  const rowRefs = React.useRef(new Map()).current;
  const currentlyOpenRowId = React.useRef<string | null>(null);

  // --- AUXILIARES ---

  const closeCurrentlyOpenRow = useCallback(() => {
    if (currentlyOpenRowId.current && rowRefs.get(currentlyOpenRowId.current)) {
      rowRefs.get(currentlyOpenRowId.current).close();
    }
  }, [rowRefs]);

  // --- CALCULOS PROJETADOS E REATIVOS (CABEÇALHO) ---

  // 1. FILTRO DE TRANSAÇÕES DO MÊS SELECIONADO NA UI
  const transacoesDoMesSelecionado = useMemo(() => {
    const selectedMonth = currentDate.getMonth();
    const selectedYear = currentDate.getFullYear();

    return transactions.filter(tx => {
      if (tx.isAdjustment) return false;
      const txDate = new Date(tx.date);
      return txDate.getMonth() === selectedMonth && txDate.getFullYear() === selectedYear;
    });
  }, [transactions, currentDate]);

  // 2. CÁLCULO DE RECEITAS E DESPESAS DO MÊS
  const monthlyStats = useMemo(() => {
    const income = transacoesDoMesSelecionado
      .filter(tx => tx.type === 'receita' && tx.paymentMethod !== 'credito')
      .reduce((acc, tx) => acc + tx.amount, 0);

    const expense = transacoesDoMesSelecionado
      .filter(tx => tx.type === 'despesa' && tx.paymentMethod !== 'credito')
      .reduce((acc, tx) => acc + tx.amount, 0);

    return { income, expense };
  }, [transacoesDoMesSelecionado]);

  // 3. LÓGICA DE NAVEGAÇÃO TEMPORAL (TIME TRAVEL)
  const temporalState = useMemo(() => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const selectedYear = currentDate.getFullYear();
    const selectedMonth = currentDate.getMonth();

    const isPassado = selectedYear < anoAtual || (selectedYear === anoAtual && selectedMonth < mesAtual);
    const isPresente = selectedYear === anoAtual && selectedMonth === mesAtual;
    const isFuturo = selectedYear > anoAtual || (selectedYear === anoAtual && selectedMonth > mesAtual);

    let titulo = '';
    let valor = 0;

    if (isPassado) {
      titulo = 'Balanço do Mês';
      valor = monthlyStats.income - monthlyStats.expense;
    } else if (isPresente) {
      titulo = 'Saldo Atual';
      valor = totalBalance;
    } else {
      titulo = 'Saldo Projetado';
      valor = totalBalance + monthlyStats.income - monthlyStats.expense;
    }

    return { titulo, valor, isPassado, isPresente, isFuturo };
  }, [currentDate, totalBalance, monthlyStats]);

  // 4. FILTRO LOCAL PARA CARDS DE CONTA (ATÉ HOJE)
  const transacoesAteHoje = useMemo(() => {
    const hojeFinalDoDia = new Date();
    hojeFinalDoDia.setHours(23, 59, 59, 999);
    const timestampHoje = hojeFinalDoDia.getTime();

    return transactions.filter(tx => {
      const txTime = new Date(tx.date).getTime();
      return txTime <= timestampHoje;
    });
  }, [transactions]);

  // 5. MOTOR DE BUSCA (LISTA PRINCIPAL)
  const displayedTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (tx.isAdjustment) return false;
        const txDate = new Date(tx.date);
        if (txDate.getMonth() !== currentDate.getMonth() || txDate.getFullYear() !== currentDate.getFullYear()) {
          return false;
        }
        if (filterType !== 'todas' && tx.type !== filterType) return false;
        if (filterAccountId !== 'todas') {
          if (tx.accountId !== filterAccountId && tx.targetAccountId !== filterAccountId) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentDate, filterType, filterAccountId]);

  // 6. PAGINAÇÃO
  const paginatedTransactions = useMemo(() => {
    return displayedTransactions.slice(0, displayLimit);
  }, [displayedTransactions, displayLimit]);

  const activeFiltersCount = (filterType !== 'todas' ? 1 : 0) + (filterAccountId !== 'todas' ? 1 : 0);

  const changeMonth = useCallback((offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  }, [currentDate]);

  const handleLoadMore = useCallback(() => {
    if (displayLimit < displayedTransactions.length) {
      setDisplayLimit((prev) => prev + 20);
    }
  }, [displayLimit, displayedTransactions.length]);

  const clearFilters = useCallback(() => {
    setFilterType('todas');
    setFilterAccountId('todas');
  }, []);

  // CÁLCULO PROJETOS ATIVOS
  const activeProjectStats = useMemo(() => {
    const activeProjects = projects.filter(p => p.active !== false);
    return activeProjects.map((project) => {
      const totalSpent = getProjectSpent(project.id);
      const progress = project.targetBudget > 0 ? Math.min(totalSpent / project.targetBudget, 1) : 0;
      const isOverBudget = totalSpent > project.targetBudget;
      return { ...project, totalSpent, progress, isOverBudget };
    });
  }, [projects, getProjectSpent]);

  // CÁLCULO METAS ATIVAS
  const activeGoalStats = useMemo(() => {
    return (goals || []).map((goal: any) => {
      const savedAmount = getGoalSavedAmount(goal.id);
      const remainingAmount = Math.max(0, goal.targetAmount - savedAmount);
      const progress = goal.targetAmount > 0 ? Math.min(savedAmount / goal.targetAmount, 1) : 0;
      
      const monthsEstimated = Math.ceil(remainingAmount / goal.monthlyContribution);
      let timeString = '';
      if (remainingAmount <= 0) {
        timeString = 'Concluída! 🎉';
      } else {
        const expectedDate = new Date();
        expectedDate.setMonth(expectedDate.getMonth() + monthsEstimated);
        const monthName = expectedDate.toLocaleString('pt-BR', { month: 'short' });
        timeString = `${monthName}/${expectedDate.getFullYear()}`;
      }

      return { ...goal, savedAmount, progress, timeString };
    });
  }, [goals, getGoalSavedAmount]);

  const layoutBeforeTransactions = useMemo(() => {
    const txIndex = homeLayout.findIndex(h => h.id === 'transactions');
    return homeLayout.slice(0, txIndex === -1 ? homeLayout.length : txIndex);
  }, [homeLayout]);

  const layoutAfterTransactions = useMemo(() => {
    const txIndex = homeLayout.findIndex(h => h.id === 'transactions');
    return txIndex === -1 ? [] : homeLayout.slice(txIndex + 1);
  }, [homeLayout]);

  const isTransactionsVisible = useMemo(() => {
    return homeLayout.find(h => h.id === 'transactions')?.visible ?? true;
  }, [homeLayout]);

  React.useEffect(() => {
    setDisplayLimit(20);
    closeCurrentlyOpenRow();
  }, [currentDate, filterType, filterAccountId, closeCurrentlyOpenRow]);

  // --- HANDLERS ---

  const handleDeletePrompt = useCallback((txId: string) => {
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
  }, [transactions, closeCurrentlyOpenRow, deleteTransaction]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSelectTx = useCallback((tx: Transaction) => {
    setSelectedTx(tx);
  }, []);

  const handleSwipeOpen = useCallback((txId: string) => {
    if (currentlyOpenRowId.current && currentlyOpenRowId.current !== txId) closeCurrentlyOpenRow();
    currentlyOpenRowId.current = txId;
  }, [closeCurrentlyOpenRow]);

  // --- RENDERIZAÇÃO ---

  const renderRightActions = useCallback((txId: string) => (
    <TouchableOpacity
      style={[styles.hiddenAction, styles.hiddenActionRight, { backgroundColor: colors.destructive }]}
      onPress={() => handleDeletePrompt(txId)}
    >
      <Ionicons name='trash-outline' size={24} color='#FFF' />
      <Text style={styles.hiddenActionText}>Apagar</Text>
    </TouchableOpacity>
  ), [colors.destructive, handleDeletePrompt]);

  const renderSection = useCallback((section: any) => {
    if (!section.visible) return null;
    
    switch (section.id) {
      case 'balance':
        return (
          <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.balanceLabel}>{temporalState.titulo}</Text>
            <Text 
              style={[
                styles.balanceValue, 
                temporalState.isPassado && temporalState.valor < 0 && { color: '#FFD7D7' }
              ]}
            >
              {formatCurrency(temporalState.valor)}
            </Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceStat}>
                <Ionicons name='arrow-up-circle' size={16} color='rgba(255,255,255,0.8)' />
                <Text style={styles.balanceStatText}>{formatCurrency(monthlyStats.income)}</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceStat}>
                <Ionicons name='arrow-down-circle' size={16} color='rgba(255,255,255,0.8)' />
                <Text style={styles.balanceStatText}>{formatCurrency(monthlyStats.expense)}</Text>
              </View>
            </View>
          </View>
        );

      case 'accounts':
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contas e Cartões</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.accountsRow}>
                {accounts.map((acc: Account) => {
                  const isCreditCard = acc.type === 'cartao_credito';
                  const currentInvoice = isCreditCard ? getCurrentOpenInvoiceTotal(acc, transacoesAteHoje) : 0;
                  let localAccBalance = 0;
                  if (!isCreditCard) {
                    transacoesAteHoje.forEach(tx => {
                      if (!tx.paid) return;
                      if (tx.accountId === acc.id) {
                        if (tx.type === 'receita') localAccBalance += tx.amount;
                        else if (tx.type === 'despesa') localAccBalance -= tx.amount;
                        else if (tx.type === 'transferencia') localAccBalance -= tx.amount;
                      }
                      if (tx.type === 'transferencia' && tx.targetAccountId === acc.id) localAccBalance += tx.amount;
                    });
                  }
                  const mainDisplayValue = isCreditCard ? currentInvoice : localAccBalance;

                  return (
                    <View key={acc.id} style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.accountIcon, { backgroundColor: acc.color + '15' }]}>
                        <Ionicons name={acc.icon as any} size={18} color={acc.color} />
                      </View>
                      <View style={styles.accountTextContainer}>
                        <Text style={[styles.accountName, { color: colors.mutedForeground }]} numberOfLines={1}>{acc.name}</Text>
                        <Text style={[styles.accountBalance, { color: colors.foreground }]}>{formatCurrency(mainDisplayValue)}</Text>
                        {isCreditCard && <Text style={[styles.secondaryText, { color: colors.mutedForeground, fontSize: 10 }]}>Fatura atual</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </>
        );

      case 'projects':
        return activeProjectStats.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Projetos Ativos</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              snapToInterval={windowWidth * 0.85 + 12}
              decelerationRate="fast"
              contentContainerStyle={{ paddingRight: 16 }}
            >
              <View style={styles.accountsRow}>
                {activeProjectStats.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedProjectForDetails(project)}
                    style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border, width: windowWidth * 0.85 }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <View style={[styles.accountIcon, { backgroundColor: project.color + '15', width: 40, height: 40, borderRadius: 12, marginBottom: 0 }]}>
                        <Ionicons name="briefcase-outline" size={20} color={project.color} />
                      </View>
                      <Text style={[styles.accountName, { color: colors.foreground, flex: 1, fontSize: 16, fontWeight: '700' }]} numberOfLines={1}>{project.name}</Text>
                    </View>
                    <View>
                      <View style={[styles.progressBarBg, { backgroundColor: colors.border, marginVertical: 16 }]}>
                        <View style={[styles.progressBarFill, { backgroundColor: project.isOverBudget ? colors.destructive : project.color, width: `${project.progress * 100}%` }]} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.secondaryText, { color: project.isOverBudget ? colors.destructive : colors.foreground, fontWeight: '800', fontSize: 14 }]}>{formatCurrency(project.totalSpent)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={[styles.secondaryText, { color: colors.mutedForeground, fontSize: 12 }]}>Meta:</Text>
                          <Text style={[styles.secondaryText, { color: colors.foreground, fontSize: 12, fontWeight: '600' }]}>{formatCurrency(project.targetBudget)}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        ) : null;

      case 'goals':
        return activeGoalStats.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Metas</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              snapToInterval={windowWidth * 0.85 + 12}
              decelerationRate="fast"
              contentContainerStyle={{ paddingRight: 16 }}
            >
              <View style={styles.accountsRow}>
                {activeGoalStats.map((goal: any) => (
                  <View
                    key={goal.id}
                    style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border, width: windowWidth * 0.85 }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <View style={[styles.accountIcon, { backgroundColor: goal.color + '15', width: 40, height: 40, borderRadius: 12, marginBottom: 0 }]}>
                        <Ionicons name="flag-outline" size={20} color={goal.color} />
                      </View>
                      <Text style={[styles.accountName, { color: colors.foreground, flex: 1, fontSize: 16, fontWeight: '700' }]} numberOfLines={1}>{goal.name}</Text>
                    </View>
                    <View>
                      <View style={[styles.progressBarBg, { backgroundColor: colors.border, marginVertical: 12 }]}>
                        <View style={[styles.progressBarFill, { backgroundColor: goal.color, width: `${goal.progress * 100}%` }]} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[styles.secondaryText, { color: colors.success, fontWeight: '800', fontSize: 14 }]}>{formatCurrency(goal.savedAmount)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={[styles.secondaryText, { color: colors.mutedForeground, fontSize: 12 }]}>Alvo:</Text>
                          <Text style={[styles.secondaryText, { color: colors.foreground, fontSize: 12, fontWeight: '600' }]}>{formatCurrency(goal.targetAmount)}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.secondaryText, { color: colors.mutedForeground, fontSize: 12 }]}>
                          Previsão: <Text style={{ color: colors.foreground, fontWeight: '600' }}>{goal.timeString}</Text>
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        ) : null;

      default:
        return null;
    }
  }, [colors, temporalState, monthlyStats, accounts, transacoesAteHoje, activeProjectStats, activeGoalStats, windowWidth]);

  const renderTransactionsHeader = useCallback(() => (
    <>
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

      <View style={[styles.dateNavigator, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navArrow}><Ionicons name="chevron-back" size={20} color={colors.primary} /></TouchableOpacity>
        <View style={styles.dateLabelContainer}>
          <Text style={[styles.monthLabel, { color: colors.foreground }]}>{MONTHS[currentDate.getMonth()]}</Text>
          <Text style={[styles.yearLabel, { color: colors.mutedForeground }]}>{currentDate.getFullYear()}</Text>
        </View>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navArrow}><Ionicons name="chevron-forward" size={20} color={colors.primary} /></TouchableOpacity>
      </View>
    </>
  ), [colors, activeFiltersCount, currentDate, changeMonth]);

  const renderHeader = useCallback(() => (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      {layoutBeforeTransactions.map((section: any) => (
        <View key={section.id}>{renderSection(section)}</View>
      ))}
      
      {isTransactionsVisible && renderTransactionsHeader()}
    </View>
  ), [layoutBeforeTransactions, renderSection, isTransactionsVisible, renderTransactionsHeader]);

  const renderFooter = useCallback(() => (
    <View style={{ gap: 16, paddingTop: 16, paddingBottom: 32 }}>
      {layoutAfterTransactions.map((section: any) => (
        <View key={section.id}>{renderSection(section)}</View>
      ))}
    </View>
  ), [layoutAfterTransactions, renderSection]);

  const renderItem = useCallback(({ item: tx, index }: { item: Transaction; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === paginatedTransactions.length - 1;
    const account = accounts.find((a) => a.id === tx.accountId);
    const tagInfo = tags.find(t => t.label === (tx as any).tag) || tags.find(t => t.label === 'Outros');

    return (
      <TransactionItem
        transaction={tx}
        account={account}
        tag={tagInfo}
        colors={colors}
        isFirst={isFirst}
        isLast={isLast}
        swipeable
        hideIcon={true}
        rowRefs={rowRefs}
        onSwipeableWillOpen={handleSwipeOpen}
        renderRightActions={renderRightActions}
      />
    );
  }, [paginatedTransactions.length, accounts, tags, colors, rowRefs, handleSwipeOpen, renderRightActions]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyExtractor = useCallback((item: Transaction) => item.id, []);

if (loading) return <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}><ActivityIndicator size='large' color={colors.primary} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={isTransactionsVisible ? paginatedTransactions : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={false}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          isTransactionsVisible ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name='calendar-outline' size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum lançamento em {MONTHS[currentDate.getMonth()]}</Text>
            </View>
          ) : null
        }
      />

      <Modal visible={isFilterModalOpen} transparent animationType='slide' onRequestClose={() => setIsFilterModalOpen(false)}>
        <View style={styles.modalOverlayBottom}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsFilterModalOpen(false)} />
          <View style={[styles.filterModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.filterModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Filtros</Text>
              <TouchableOpacity onPress={() => setIsFilterModalOpen(false)} style={[styles.closeBtn, { backgroundColor: colors.background }]}><Ionicons name='close' size={20} color={colors.foreground} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }}>
              <Text style={[styles.filterGroupLabel, { color: colors.mutedForeground }]}>Tipo</Text>
              <View style={styles.chipRow}>
                {(['todas', 'receita', 'despesa', 'transferencia'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, { borderColor: colors.border, backgroundColor: filterType === t ? colors.primary : 'transparent' }]} onPress={() => setFilterType(t)}>
                    <Text style={[styles.chipText, { color: filterType === t ? '#FFF' : colors.foreground }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.filterGroupLabel, { color: colors.mutedForeground, marginTop: 20 }]}>Contas</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity style={[styles.chip, { borderColor: colors.border, backgroundColor: filterAccountId === 'todas' ? colors.primary : 'transparent' }]} onPress={() => setFilterAccountId('todas')}><Text style={[styles.chipText, { color: filterAccountId === 'todas' ? '#FFF' : colors.foreground }]}>Todas</Text></TouchableOpacity>
                {accounts.map((acc) => (
                  <TouchableOpacity key={acc.id} style={[styles.chip, { borderColor: acc.color, backgroundColor: filterAccountId === acc.id ? acc.color : 'transparent' }]} onPress={() => setFilterAccountId(acc.id)}>
                    <Text style={[styles.chipText, { color: filterAccountId === acc.id ? '#FFF' : acc.color }]}>{acc.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: 30 }} />
            </ScrollView>
            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.foreground }]} onPress={() => setIsFilterModalOpen(false)}><Text style={[styles.applyBtnText, { color: colors.background }]}>Aplicar Filtros</Text></TouchableOpacity>
            {activeFiltersCount > 0 && (
              <TouchableOpacity onPress={clearFilters} style={{ marginTop: 15, alignItems: 'center' }}><Text style={{ color: colors.destructive, fontWeight: '600' }}>Limpar Filtros</Text></TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <RecurrenceActionModal visible={!!recurrenceDeleteData} actionType='delete' onClose={() => setRecurrenceDeleteData(null)} onSelect={(mode) => { if (recurrenceDeleteData) deleteTransaction(recurrenceDeleteData, mode); setRecurrenceDeleteData(null); }} />

      {selectedProjectForDetails && (
        <ProjectTransactionsModal project={selectedProjectForDetails} onClose={() => setSelectedProjectForDetails(null)} />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  balanceCard: { borderRadius: 20, padding: 24, gap: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  balanceValue: { color: '#FFF', fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceStatText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  balanceDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.3)' },
  dateNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth },
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
  projectCard: { borderRadius: 24, padding: 20, borderWidth: StyleSheet.hairlineWidth, minHeight: 120 },
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
  modalOverlayBottom: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 999, elevation: 999 },
  filterModalContent: { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  filterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  filterGroupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '600' },
  applyBtn: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  applyBtnText: { fontSize: 16, fontWeight: '700' },
  hiddenAction: { justifyContent: 'center', alignItems: 'center', width: 80 },
  hiddenActionRight: { borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  hiddenActionText: { color: '#FFF', fontSize: 10, fontWeight: '700', marginTop: 4 },
  progressBarBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
});