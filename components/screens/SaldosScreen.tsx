import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, FlatList, ScrollView, Alert, Modal, TextInput, Switch, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { financialDate, goalForecast } from '@/lib/financialDate';
import { DEFAULT_SALDOS_FILTERS, EMPTY_PROJECT, filterMonth, FinancialIndex, SaldosFilters } from '@/lib/financialIndex';
import { Account, Goal, HomeSection, Project, TabType, Transaction } from '@/constants/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '@/constants/theme';
import { ProjectTransactionsModal } from '../ProjectTransactionsModal';
import { RecurrenceActionModal } from '../RecurrenceActionModal';
import { TransactionItem } from '../TransactionItem';

export interface SaldosViewState { month: string; filters: SaldosFilters; limit: number; scrollOffset: number }
interface Props { viewStateRef?: React.MutableRefObject<SaldosViewState | null>; onNavigate?: (tab: TabType, accountId?: string) => void }
const EMPTY_TRANSACTIONS: Transaction[] = [];
const monthLabel = (month: string) => financialDate(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const filterCount = (f: SaldosFilters) => Number(f.type !== 'todas') + Number(f.accountId !== 'todas') + Number(f.status !== 'todos') + Number(!!f.query.trim()) + Number(f.includeAdjustments);

// Blocos independentes da busca e paginação: digitar não reconstrói todos os cards.
const OverviewSections = React.memo(function OverviewSections({ sections, index, month, today, accounts, projects, goals, colors, width, fontScale, onNavigate, onProject, onAccount }: {
  sections: HomeSection[]; index: FinancialIndex; month: string; today: string; accounts: Account[]; projects: Project[]; goals: Goal[];
  colors: ThemeColors; width: number; fontScale: number; onNavigate?: Props['onNavigate']; onProject: (project: Project) => void; onAccount: (account: Account) => void;
}) {
  const money = (value: number) => formatCurrency(value);
  const text = { color: colors.foreground };
  const muted = { color: colors.mutedForeground };
  const surface = { backgroundColor: colors.card, borderColor: colors.border };
  const activeProjects = useMemo(() => projects.filter(p => p.active !== false), [projects]);
  const summary = index.summary(month);
  const totalExpenses = (Math.round(summary.expense * 100) + Math.round(summary.pendingExpense * 100)) / 100;
  return <>
    {sections.filter(s => s.visible).map(section => {
      if (section.id === 'balance') return <View key={section.id} testID="saldos-summary" style={[styles.card, surface, { borderTopWidth: 4, borderTopColor: colors.primary }]}>
        <Text style={[styles.label, muted]}>Saldo realizado hoje</Text>
        <Text style={[styles.balance, { color: index.totalBalance < 0 ? colors.destructive : colors.foreground }]}>{money(index.totalBalance)}</Text>
        <Text style={[styles.caption, muted]}>Resumo de {monthLabel(month)}</Text>
        <View style={styles.stats}>
          <View style={[styles.stat, width / fontScale < 340 && { flexBasis: '100%' }]}><Text style={[styles.caption, muted]}>Receitas realizadas</Text><Text style={[styles.value, text]}>{money(summary.income)}</Text></View>
          <View style={[styles.stat, width / fontScale < 340 && { flexBasis: '100%' }]}><Text style={[styles.caption, muted]}>Todas as despesas</Text><Text style={[styles.value, text]}>{money(totalExpenses)}</Text></View>
        </View>
      </View>;
      if (section.id === 'accounts') return <View key={section.id} style={styles.section}>
        <Text style={[styles.title, text]}>Contas e cartões — hoje</Text>
        {accounts.length === 0 ? <TouchableOpacity accessibilityRole="button" onPress={() => onNavigate?.('contas')}><Text style={text}>Cadastre sua primeira conta</Text></TouchableOpacity> :
          <FlatList horizontal data={accounts} keyExtractor={a => a.id} showsHorizontalScrollIndicator={false} initialNumToRender={3} windowSize={3} renderItem={({ item: account }) => {
            const card = account.type === 'cartao_credito';
            return <TouchableOpacity accessibilityRole="button" accessibilityLabel={card ? `Abrir cartão ${account.name}` : `Ver lançamentos de ${account.name}`} onPress={() => onAccount(account)} style={[styles.smallCard, surface, { width: Math.min(width - 32, 220) }]}>
              <Ionicons name={account.icon as any} size={22} color={account.color} />
              <Text style={[styles.label, text]}>{account.name}</Text>
              <Text style={[styles.value, text]}>{money(card ? index.openInvoiceTotals.get(account.id) || 0 : index.balances.get(account.id) || 0)}</Text>
              <Text style={[styles.caption, muted]}>{card ? 'Fatura aberta registrada' : 'Saldo realizado hoje'}</Text>
              {card && <Text style={[styles.caption, muted]}>Total a pagar, com parcelas: {money(index.cardDebt.get(account.id) || 0)}</Text>}
            </TouchableOpacity>;
          }} />}
      </View>;
      if (section.id === 'projects' && activeProjects.length) return <View key={section.id} style={styles.section}>
        <Text style={[styles.title, text]}>Projetos — acumulado</Text>
        <FlatList horizontal data={activeProjects} keyExtractor={p => p.id} initialNumToRender={2} windowSize={3} showsHorizontalScrollIndicator={false} renderItem={({ item: project }) => {
          const stats = index.projects.get(project.id) || EMPTY_PROJECT;
          const progress = project.targetBudget > 0 ? Math.min(stats.spent / project.targetBudget, 1) : 0;
          return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Abrir projeto ${project.name}`} onPress={() => onProject(project)} style={[styles.wideCard, surface, { width: Math.min(width - 48, 420) }]}>
            <Text style={[styles.title, text]}>{project.name}</Text>
            <Text style={[styles.caption, muted]}>Orçamento comprometido (realizado + previsto)</Text>
            <View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: stats.spent > project.targetBudget ? colors.destructive : project.color }]} /></View>
            <Text style={[styles.label, text]}>Saldo realizado: {money(stats.realisedIncome - stats.realisedSpent)}</Text>
            <Text style={[styles.caption, muted]}>Recebido: {money(stats.realisedIncome)} • Gasto realizado: {money(stats.realisedSpent)}</Text>
            <Text style={[styles.caption, muted]}>Receitas previstas: {money(stats.income - stats.realisedIncome)} • Gastos previstos: {money(stats.spent - stats.realisedSpent)}</Text>
            <Text style={[styles.caption, text]}>Orçamento restante: {money(project.targetBudget - stats.spent)}</Text>
          </TouchableOpacity>;
        }} />
      </View>;
      if (section.id === 'goals' && goals.length) return <View key={section.id} style={styles.section}>
        <Text style={[styles.title, text]}>Metas — realizado até hoje</Text>
        <FlatList horizontal data={goals} keyExtractor={g => g.id} initialNumToRender={2} windowSize={3} showsHorizontalScrollIndicator={false} renderItem={({ item: goal }) => {
          const saved = index.goalAmounts.get(goal.id) || 0;
          const progress = goal.targetAmount > 0 ? Math.min(saved / goal.targetAmount, 1) : 0;
          return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Gerenciar meta ${goal.name}`} onPress={() => onNavigate?.('metas', goal.id)} style={[styles.wideCard, surface, { width: Math.min(width - 48, 420) }]}>
            <Text style={[styles.title, text]}>{goal.name}</Text>
            <View style={[styles.track, { backgroundColor: colors.border }]}><View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: goal.color }]} /></View>
            <Text style={[styles.label, text]}>Guardado: {money(saved)}</Text>
            <Text style={[styles.caption, muted]}>Alvo: {money(goal.targetAmount)}</Text>
            <Text style={[styles.caption, muted]}>Previsão: {goalForecast(goal.targetAmount - saved, goal.monthlyContribution, financialDate(today))}</Text>
          </TouchableOpacity>;
        }} />
      </View>;
      return null;
    })}
  </>;
});

export function SaldosScreen({ viewStateRef, onNavigate }: Props) {
  const { colors } = useTheme();
  const primaryRgb = colors.primary.replace('#', '').match(/.{2}/g)?.map(value => parseInt(value, 16)) || [0, 0, 0];
  const monthForeground = primaryRgb[0] * 0.299 + primaryRgb[1] * 0.587 + primaryRgb[2] * 0.114 > 150 ? '#1A1A1A' : '#FFFFFF';
  const dimensions = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = dimensions.width - insets.left - insets.right;
  const fontScale = dimensions.fontScale;
  const { accounts, transactions, tags, projects, goals, homeLayout, financialIndex: index, today, deleteTransaction, updateTransaction } = useStoreContext();
  const initial = useRef(viewStateRef?.current);
  const [month, setMonth] = useState(initial.current?.month || today.slice(0, 7));
  const [filters, setFilters] = useState<SaldosFilters>(initial.current?.filters || DEFAULT_SALDOS_FILTERS);
  const [limit, setLimit] = useState(initial.current?.limit || 20);
  const [draft, setDraft] = useState(filters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deleteFamilyId, setDeleteFamilyId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, { close: () => void }>()).current;
  const openedRow = useRef<string | null>(null);
  const previousToday = useRef(today);
  const scrollOffset = useRef(initial.current?.scrollOffset || 0);
  const deferredQuery = useDeferredValue(filters.query);
  const effectiveFilters = useMemo(() => ({ ...filters, query: deferredQuery }), [filters, deferredQuery]);
  const filtered = useMemo(() => filterMonth(index, month, effectiveFilters), [index, month, effectiveFilters]);
  const visibleTransactions = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const tagByLabel = useMemo(() => new Map(tags.map(tag => [tag.label, tag])), [tags]);
  const activeCount = filterCount(filters);
  const layout = useMemo(() => {
    const position = homeLayout.findIndex(s => s.id === 'transactions');
    return { before: homeLayout.slice(0, position < 0 ? homeLayout.length : position), after: position < 0 ? [] : homeLayout.slice(position + 1), transactions: homeLayout.find(s => s.id === 'transactions')?.visible ?? true };
  }, [homeLayout]);
  const closeRow = useCallback(() => { if (openedRow.current) rowRefs.get(openedRow.current)?.close(); openedRow.current = null; }, [rowRefs]);
  useEffect(() => {
    if (month === previousToday.current.slice(0, 7) && previousToday.current !== today) setMonth(today.slice(0, 7));
    previousToday.current = today;
  }, [today, month]);
  useEffect(() => {
    if (viewStateRef) viewStateRef.current = { month, filters, limit, scrollOffset: scrollOffset.current };
  }, [month, filters, limit, viewStateRef]);
  useEffect(() => { closeRow(); }, [month, filters, closeRow]);
  useEffect(() => {
    if (filters.accountId !== 'todas' && !index.accountById.has(filters.accountId)) setFilters(previous => ({ ...previous, accountId: 'todas' }));
  }, [index, filters.accountId]);
  const navigateMonth = useCallback((offset: number) => {
    setMonth(previous => { const date = financialDate(`${previous}-01`); date.setMonth(date.getMonth() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; });
    setLimit(20);
  }, []);
  const clearFilters = useCallback(() => { setFilters(DEFAULT_SALDOS_FILTERS); setDraft(DEFAULT_SALDOS_FILTERS); setLimit(20); }, []);
  const openAccount = useCallback((account: Account) => {
    if (account.type === 'cartao_credito') onNavigate?.('cartao', account.id);
    else { setFilters({ ...DEFAULT_SALDOS_FILTERS, accountId: account.id }); setMonth(today.slice(0, 7)); setLimit(20); }
  }, [onNavigate, today]);
  const remove = useCallback(async (id: string, mode: 'single' | 'future' | 'all') => {
    try { await deleteTransaction(id, mode); }
    catch { Alert.alert('Erro', 'Não foi possível excluir o lançamento. Tente novamente.'); }
  }, [deleteTransaction]);
  const promptDelete = useCallback((id: string) => {
    closeRow();
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    if (tx.groupId) setDeleteFamilyId(id);
    else Alert.alert('Excluir lançamento', 'Deseja excluir este lançamento?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => { void remove(id, 'single'); } }]);
  }, [transactions, closeRow, remove]);
  const confirmPayment = useCallback((tx: Transaction) => {
    if (busyId) return;
    Alert.alert('Confirmar realização', 'O pagamento ou recebimento já aconteceu? A data será atualizada para hoje.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        setBusyId(tx.id);
        try { await updateTransaction({ ...tx, paid: true, date: today }, 'single'); }
        catch { Alert.alert('Erro', 'Não foi possível confirmar o lançamento. Tente novamente.'); }
        finally { setBusyId(null); }
      } },
    ]);
  }, [busyId, today, updateTransaction]);
  const onSwipeOpen = useCallback((id: string) => { if (openedRow.current !== id) closeRow(); openedRow.current = id; }, [closeRow]);
  const renderActions = useCallback((id: string) => <TouchableOpacity accessibilityRole="button" accessibilityLabel="Excluir lançamento" onPress={() => promptDelete(id)} style={[styles.deleteAction, { backgroundColor: colors.destructive }]}><Text style={{ color: '#FFF' }}>Excluir</Text></TouchableOpacity>, [promptDelete, colors.destructive]);
  const renderItem = useCallback(({ item: tx, index: position }: { item: Transaction; index: number }) => {
    const meta = index.metadata.get(tx.id)!;
    const previous = visibleTransactions[position - 1];
    return <View>
      {(!previous || index.metadata.get(previous.id)?.day !== meta.day) && <Text style={[styles.dayHeading, { color: colors.mutedForeground }]}>{formatDate(meta.day)}</Text>}
      <TransactionItem transaction={tx} account={index.accountById.get(tx.accountId)} targetAccount={index.accountById.get(tx.targetAccountId || '')} selectedAccountId={filters.accountId} status={meta.status} tag={tagByLabel.get(tx.tag || '')} colors={colors} hideIcon swipeable rowRefs={rowRefs} onSwipeableWillOpen={onSwipeOpen} renderRightActions={renderActions} onConfirm={busyId ? undefined : confirmPayment} />
    </View>;
  }, [index, visibleTransactions, filters.accountId, tagByLabel, colors, rowRefs, onSwipeOpen, renderActions, busyId, confirmPayment]);
  const blocks = { index, month, today, accounts, projects, goals, colors, width, fontScale, onNavigate, onProject: setSelectedProject, onAccount: openAccount };
  const header = <View style={styles.section}>
    <View testID="saldos-month-card" style={[styles.card, styles.monthCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <View style={styles.monthNavigation}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => navigateMonth(-1)} style={styles.iconButton}><Ionicons name="chevron-back" size={24} color={monthForeground} /></TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.title, { color: monthForeground, flex: 1, textAlign: 'center' }]}>{monthLabel(month)}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => navigateMonth(1)} style={styles.iconButton}><Ionicons name="chevron-forward" size={24} color={monthForeground} /></TouchableOpacity>
      </View>
    </View>
    <OverviewSections sections={layout.before} {...blocks} />
    {layout.transactions && <View style={styles.section}>
      <View style={styles.toolbar}><Text style={[styles.title, { color: colors.foreground }]}>Lançamentos</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Filtrar lançamentos, ${activeCount} filtros ativos`} onPress={() => { setDraft(filters); setFilterOpen(true); }} style={styles.iconButton}><Text style={{ color: colors.foreground }}>Filtros{activeCount ? ` (${activeCount})` : ''}</Text></TouchableOpacity></View>
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>Filtros e busca alteram somente os lançamentos. O resumo acima considera todas as contas.</Text>
      <TextInput accessibilityLabel="Buscar lançamentos" placeholder="Buscar por descrição" placeholderTextColor={colors.mutedForeground} value={filters.query} onChangeText={query => { setFilters(previous => ({ ...previous, query })); setLimit(20); }} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} />
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>{Math.min(limit, filtered.length)} de {filtered.length} lançamentos{filters.accountId !== 'todas' ? ` • ${index.accountById.get(filters.accountId)?.name || ''}` : ''}</Text>
    </View>}
  </View>;
  const footer = <View style={styles.section}>
    {layout.transactions && (limit < filtered.length ? <TouchableOpacity accessibilityRole="button" onPress={() => setLimit(v => v + 20)} style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Carregar mais 20 lançamentos</Text></TouchableOpacity> : filtered.length > 0 ? <Text style={[styles.caption, { color: colors.mutedForeground }]}>Fim dos lançamentos deste filtro.</Text> : null)}
    <OverviewSections sections={layout.after} {...blocks} />
  </View>;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <FlatList data={layout.transactions ? visibleTransactions : EMPTY_TRANSACTIONS} keyExtractor={tx => tx.id} renderItem={renderItem} ListHeaderComponent={header} ListFooterComponent={footer} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} contentOffset={{ x: 0, y: initial.current?.scrollOffset || 0 }} scrollEventThrottle={200} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; if (viewStateRef?.current) viewStateRef.current.scrollOffset = scrollOffset.current; }} ListEmptyComponent={layout.transactions ? <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={{ color: colors.foreground }}>{activeCount ? 'Nenhum lançamento corresponde aos filtros.' : `Nenhum lançamento em ${monthLabel(month)}.`}</Text>
      {activeCount > 0 && <TouchableOpacity accessibilityRole="button" onPress={clearFilters} style={styles.iconButton}><Text style={{ color: colors.foreground, textDecorationLine: 'underline' }}>Limpar filtros</Text></TouchableOpacity>}
    </View> : null} />
    <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
      <View style={styles.overlay}><Pressable accessibilityLabel="Cancelar filtros" style={StyleSheet.absoluteFill} onPress={() => setFilterOpen(false)} />
        <View style={[styles.modal, { backgroundColor: colors.card, paddingBottom: Math.max(24, insets.bottom + 16) }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Filtrar lançamentos</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.foreground }]}>Tipo</Text>
            <View style={styles.chips}>{(['todas', 'receita', 'despesa', 'transferencia'] as const).map(type => <FilterChip key={type} label={{ todas: 'Todos os tipos', receita: 'Receita', despesa: 'Despesa', transferencia: 'Transferência' }[type]} selected={draft.type === type} onPress={() => setDraft(v => ({ ...v, type }))} colors={colors} />)}</View>
            <Text style={[styles.label, { color: colors.foreground }]}>Situação</Text>
            <View style={styles.chips}>{(['todos', 'realizado', 'previsto', 'vencido'] as const).map(status => <FilterChip key={status} label={{ todos: 'Todas as situações', realizado: 'Realizado', previsto: 'Previsto', vencido: 'Vencido' }[status]} selected={draft.status === status} onPress={() => setDraft(v => ({ ...v, status }))} colors={colors} />)}</View>
            <Text style={[styles.label, { color: colors.foreground }]}>Conta</Text>
            <View style={styles.chips}><FilterChip label="Todas as contas" selected={draft.accountId === 'todas'} onPress={() => setDraft(v => ({ ...v, accountId: 'todas' }))} colors={colors} />{accounts.map(account => <FilterChip key={account.id} label={account.name} selected={draft.accountId === account.id} onPress={() => setDraft(v => ({ ...v, accountId: account.id }))} colors={colors} />)}</View>
            <View style={styles.toolbar}><Text style={[styles.caption, { color: colors.foreground, flex: 1 }]}>Mostrar ajustes e saldos iniciais</Text><Switch accessibilityLabel="Mostrar ajustes e saldos iniciais" value={draft.includeAdjustments} onValueChange={includeAdjustments => setDraft(v => ({ ...v, includeAdjustments }))} /></View>
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" style={[styles.button, { backgroundColor: colors.foreground }]} onPress={() => { setFilters(draft); setLimit(20); setFilterOpen(false); }}><Text style={{ color: colors.background }}>Aplicar filtros</Text></TouchableOpacity>
          <View style={styles.toolbar}><TouchableOpacity accessibilityRole="button" style={styles.iconButton} onPress={() => setDraft(DEFAULT_SALDOS_FILTERS)}><Text style={{ color: colors.foreground }}>Limpar seleção</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.iconButton} onPress={() => setFilterOpen(false)}><Text style={{ color: colors.foreground }}>Cancelar</Text></TouchableOpacity></View>
        </View>
      </View>
    </Modal>
    <RecurrenceActionModal visible={!!deleteFamilyId} actionType="delete" onClose={() => setDeleteFamilyId(null)} onSelect={mode => { if (deleteFamilyId) void remove(deleteFamilyId, mode); setDeleteFamilyId(null); }} />
    {selectedProject && <ProjectTransactionsModal project={selectedProject} onClose={() => setSelectedProject(null)} />}
  </View>;
}

function FilterChip({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: ThemeColors }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? colors.foreground : colors.card, borderColor: colors.border }]}><Text style={{ color: selected ? colors.background : colors.foreground }}>{label}</Text></TouchableOpacity>;
}
const styles = StyleSheet.create({
  monthCard: { padding: 8, gap: 0 }, monthNavigation: { flexDirection: 'row', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 }, section: { gap: 12, marginBottom: 16 }, card: { padding: 20, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', flexShrink: 1 }, label: { fontSize: 14, fontWeight: '600', marginVertical: 4 }, caption: { fontSize: 13, lineHeight: 19 }, balance: { fontSize: 32, fontWeight: '700', flexShrink: 1 }, value: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }, iconButton: { padding: 12, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginVertical: 8 }, stat: { flexBasis: '44%', flexGrow: 1, gap: 4 },
  smallCard: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginRight: 12, gap: 6 }, wideCard: { padding: 20, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, marginRight: 12, gap: 8 }, track: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 8 }, fill: { height: 8, borderRadius: 4 },
  input: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 16 }, button: { padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', marginVertical: 12 }, dayHeading: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 }, deleteAction: { width: 88, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }, modal: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, gap: 12 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, chip: { borderWidth: 1, borderRadius: 20, padding: 12, minHeight: 44 },
});
