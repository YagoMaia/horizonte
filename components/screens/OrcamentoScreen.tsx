// components/screens/OrcamentoScreen.tsx
import React, { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useStoreContext } from '@/context/StoreContext'
import { RecurringExpenseCategory, BudgetAllocation } from '@/constants/types'
import { AllocationEditorModal } from './orcamento/AllocationEditorModal'

// ────────────────────────────────────────────────────────────────────────────────
// Dados estáticos auxiliares
// ────────────────────────────────────────────────────────────────────────────────

export const CATEGORY_META: Record<
  RecurringExpenseCategory,
  { label: string; icon: string; color: string }
> = {
  investimento: { label: 'Investimento', icon: 'trending-up-outline',        color: '#388E3C' },
  fixo:         { label: 'Fixo',         icon: 'home-outline',               color: '#1976D2' },
  variavel:     { label: 'Variável',     icon: 'swap-horizontal-outline',    color: '#F57C00' },
  outros:       { label: 'Outros',       icon: 'ellipsis-horizontal-outline', color: '#7B1FA2' },
}

const ALLOCATION_META: Record<
  keyof BudgetAllocation,
  { label: string; color: string; icon: string }
> = {
  investimento: { label: 'Investimentos',    color: '#388E3C', icon: 'trending-up-outline' },
  fixo:         { label: 'Gastos Fixos',     color: '#1976D2', icon: 'home-outline' },
  variavel:     { label: 'Gastos Variáveis', color: '#F57C00', icon: 'swap-horizontal-outline' },
  outros:       { label: 'Outras Demandas',  color: '#7B1FA2', icon: 'ellipsis-horizontal-outline' },
}

const RECURRENCE_LABEL: Record<string, string> = {
  mensal:          'Mensal',
  anual:           'Anual',
  semanal:         'Semanal',
  diaria:          'Diária',
  quinto_dia_util: '5º dia útil',
}

const CATEGORIES: RecurringExpenseCategory[] = ['investimento', 'fixo', 'variavel', 'outros']

// ────────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────────

interface DetectedItem {
  groupId: string
  description: string
  amount: number
  recurrence: string
  type: 'despesa' | 'transferencia'
  sourceAccountName: string
  targetAccountName?: string   // para transferências
  autoCategory: RecurringExpenseCategory
  category: RecurringExpenseCategory // final (auto ou override do usuário)
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ────────────────────────────────────────────────────────────────────────────────
// Subcomponente: CategoryPickerModal
// ────────────────────────────────────────────────────────────────────────────────

interface CategoryPickerProps {
  visible: boolean
  item: DetectedItem | null
  onClose: () => void
  onSelect: (groupId: string, category: RecurringExpenseCategory) => void
  colors: any
}

function CategoryPickerModal({ visible, item, onClose, onSelect, colors }: CategoryPickerProps) {
  if (!item) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <View style={[pickerStyles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[pickerStyles.title, { color: colors.foreground }]}>
            Reclassificar gasto
          </Text>
          <Text style={[pickerStyles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.description}
          </Text>

          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat]
            const isSelected = item.category === cat
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  pickerStyles.option,
                  {
                    backgroundColor: isSelected ? meta.color + '18' : colors.secondary,
                    borderColor: isSelected ? meta.color : colors.border,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  onSelect(item.groupId, cat)
                  onClose()
                }}
                activeOpacity={0.7}
              >
                <View style={[pickerStyles.optionIcon, { backgroundColor: meta.color + '20' }]}>
                  <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                </View>
                <Text style={[pickerStyles.optionLabel, { color: isSelected ? meta.color : colors.foreground }]}>
                  {meta.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color={meta.color} />
                )}
              </TouchableOpacity>
            )
          })}

          <TouchableOpacity style={[pickerStyles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={[pickerStyles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Tela principal: OrcamentoScreen
// ────────────────────────────────────────────────────────────────────────────────

export function OrcamentoScreen() {
  const { colors } = useTheme()
  const store = useStoreContext()
  const {
    transactions,
    accounts,
    budgetAllocation,
    saveBudgetAllocation,
    monthlyIncome,
    recurringOverrides,
    saveRecurringOverride,
  } = store

  const [allocVisible, setAllocVisible] = useState(false)
  const [pickerItem, setPickerItem] = useState<DetectedItem | null>(null)
  const [filterCategory, setFilterCategory] = useState<RecurringExpenseCategory | 'all'>('all')

  // ── Auto-detecção de transações recorrentes ──────────────────────────────────
  const detectedItems = useMemo((): DetectedItem[] => {
    const seen = new Set<string>()
    const items: DetectedItem[] = []

    // Ordena pelo groupIndex para garantir pegar o item original (index 0) primeiro
    const sorted = [...transactions].sort((a, b) => {
      const ia = a.groupIndex ?? 0
      const ib = b.groupIndex ?? 0
      return ia - ib
    })

    for (const tx of sorted) {
      // Só transações recorrentes (não únicas)
      if (tx.recurrence === 'unica' || !tx.recurrence) continue
      // Só despesas e transferências (receitas são a renda, não gasto)
      if (tx.type === 'receita') continue

      // Chave única por grupo de recorrência
      const key = tx.groupId || tx.id.split('-')[0]
      if (seen.has(key)) continue
      seen.add(key)

      // Conta de origem
      const sourceAcc = accounts.find(a => a.id === tx.accountId)
      const sourceAccountName = sourceAcc?.name ?? 'Conta'

      // Classificação automática por tipo e destino
      let autoCategory: RecurringExpenseCategory = 'fixo'
      let targetAccountName: string | undefined

      if (tx.type === 'transferencia') {
        const destId = tx.targetAccountId ?? tx.toAccountId
        if (destId?.startsWith('goal_')) {
          // Transferência para meta de poupança
          autoCategory = 'investimento'
          targetAccountName = 'Meta de Poupança'
        } else {
          const destAcc = accounts.find(a => a.id === destId)
          targetAccountName = destAcc?.name
          if (destAcc?.type === 'investimento') {
            autoCategory = 'investimento'
          } else {
            // Transferência entre contas correntes/poupança → outros
            autoCategory = 'outros'
          }
        }
      }
      // despesa → padrão 'fixo', usuário pode mudar para 'variavel'

      const category = recurringOverrides[key] ?? autoCategory

      items.push({
        groupId: key,
        description: tx.description,
        amount: tx.amount,
        recurrence: tx.recurrence,
        type: tx.type as 'despesa' | 'transferencia',
        sourceAccountName,
        targetAccountName,
        autoCategory,
        category,
      })
    }

    return items
  }, [transactions, accounts, recurringOverrides])

  // ── Totais por categoria ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat] = detectedItems
        .filter(i => i.category === cat)
        .reduce((s, i) => s + i.amount, 0)
      return acc
    }, {} as Record<RecurringExpenseCategory, number>)
  }, [detectedItems])

  const totalCommitted = useMemo(
    () => Object.values(totals).reduce((a, b) => a + b, 0),
    [totals],
  )

  // ── Renda de referência ──────────────────────────────────────────────────────
  // Prefere a receita real do mês; se não houver, usa total comprometido como estimativa
  const referenceIncome = monthlyIncome > 0 ? monthlyIncome : totalCommitted

  // ── Alocação teórica em R$ ───────────────────────────────────────────────────
  const theoreticalAlloc = useMemo((): Record<keyof BudgetAllocation, number> => ({
    investimento: (referenceIncome * budgetAllocation.investimento) / 100,
    fixo:         (referenceIncome * budgetAllocation.fixo) / 100,
    variavel:     (referenceIncome * budgetAllocation.variavel) / 100,
    outros:       (referenceIncome * budgetAllocation.outros) / 100,
  }), [referenceIncome, budgetAllocation])

  // ── Filtro de lista ──────────────────────────────────────────────────────────
  const filteredItems = useMemo(() =>
    filterCategory === 'all'
      ? detectedItems
      : detectedItems.filter(i => i.category === filterCategory),
  [detectedItems, filterCategory])

  const handleCategorySelect = useCallback(
    (groupId: string, category: RecurringExpenseCategory) => {
      saveRecurringOverride(groupId, category)
    },
    [saveRecurringOverride],
  )

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Cabeçalho ── */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Orçamento Mensal</Text>
          <Text style={[styles.screenSubtitle, { color: colors.mutedForeground }]}>
            Baseado nas suas recorrências
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.configBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => setAllocVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* ── Renda de referência ── */}
      <View style={[styles.incomeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.incomeCardLeft}>
          <Ionicons name="cash-outline" size={20} color="#388E3C" />
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.incomeLabel, { color: colors.mutedForeground }]}>
              {monthlyIncome > 0 ? 'Receitas do mês (real)' : 'Total comprometido (estimado)'}
            </Text>
            <Text style={[styles.incomeValue, { color: colors.foreground }]}>
              {fmt(referenceIncome)}
            </Text>
          </View>
        </View>
        <View style={[styles.incomeBadge, {
          backgroundColor: monthlyIncome > 0 ? '#388E3C20' : '#F57C0020',
        }]}>
          <Text style={[styles.incomeBadgeText, { color: monthlyIncome > 0 ? '#388E3C' : '#F57C00' }]}>
            {monthlyIncome > 0 ? 'Real' : 'Estimado'}
          </Text>
        </View>
      </View>

      {/* ── Divisão teórica ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionCardHeader}>
          <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>Divisão Teórica</Text>
          <TouchableOpacity
            onPress={() => setAllocVisible(true)}
            style={styles.editBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Editar %</Text>
          </TouchableOpacity>
        </View>

        {/* Barra empilhada */}
        <View style={styles.stackedBar}>
          {(Object.keys(budgetAllocation) as (keyof BudgetAllocation)[]).map((key) => (
            <View
              key={key}
              style={[styles.stackedBarSegment, {
                flex: budgetAllocation[key],
                backgroundColor: ALLOCATION_META[key].color,
              }]}
            />
          ))}
        </View>

        {/* Linhas de detalhe */}
        {(Object.keys(budgetAllocation) as (keyof BudgetAllocation)[]).map((key) => {
          const meta = ALLOCATION_META[key]
          const theoretical = theoreticalAlloc[key]
          const actual = totals[key as RecurringExpenseCategory] ?? 0
          const diff = theoretical - actual
          const isOk = actual <= theoretical

          return (
            <View key={key} style={[styles.allocItem, { borderBottomColor: colors.border }]}>
              <View style={[styles.allocDot, { backgroundColor: meta.color }]} />
              <View style={styles.allocCenter}>
                <Text style={[styles.allocLabel, { color: colors.foreground }]}>{meta.label}</Text>
                {/* Mini barra de progresso */}
                <View style={[styles.miniBar, { backgroundColor: colors.muted }]}>
                  <View style={[styles.miniBarFill, {
                    backgroundColor: meta.color,
                    width: `${Math.min(actual / Math.max(theoretical, 1) * 100, 100)}%` as any,
                  }]} />
                </View>
              </View>
              <View style={styles.allocRight}>
                <Text style={[styles.allocPct, { color: meta.color }]}>
                  {budgetAllocation[key]}%
                </Text>
                <Text style={[styles.allocVal, { color: colors.foreground }]}>
                  {fmt(theoretical)}
                </Text>
                {referenceIncome > 0 && (
                  <Text style={[styles.allocDiff, { color: isOk ? '#388E3C' : '#D32F2F' }]}>
                    {isOk
                      ? diff > 0 ? `+${fmt(diff)} livre` : 'No limite'
                      : `${fmt(Math.abs(diff))} acima`}
                  </Text>
                )}
              </View>
            </View>
          )
        })}
      </View>

      {/* ── Resumo comprometido ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>Comprometido por Categoria</Text>
        {CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat]
          return (
            <View key={cat} style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.summaryIcon, { backgroundColor: meta.color + '18' }]}>
                <Ionicons name={meta.icon as any} size={16} color={meta.color} />
              </View>
              <Text style={[styles.summaryLabel, { color: colors.foreground }]}>{meta.label}</Text>
              <Text style={[styles.summaryValue, { color: meta.color }]}>{fmt(totals[cat])}</Text>
            </View>
          )
        })}
        <View style={[styles.summaryTotalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.summaryTotalLabel, { color: colors.foreground }]}>Total recorrente</Text>
          <Text style={[styles.summaryTotalValue, { color: colors.foreground }]}>{fmt(totalCommitted)}</Text>
        </View>
      </View>

      {/* ── Lista de recorrências detectadas ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.listHeader}>
          <View>
            <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>Recorrências Detectadas</Text>
            <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>
              Toque na categoria para reclassificar
            </Text>
          </View>
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {(['all', ...CATEGORIES] as const).map((cat) => {
            const selected = filterCategory === cat
            const meta = cat !== 'all' ? CATEGORY_META[cat] : null
            const color = meta ? meta.color : colors.primary
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, {
                  backgroundColor: selected ? color + '20' : colors.secondary,
                  borderColor: selected ? color : colors.border,
                  borderWidth: selected ? 1.5 : 1,
                }]}
                onPress={() => setFilterCategory(cat as any)}
                activeOpacity={0.7}
              >
                {meta && <Ionicons name={meta.icon as any} size={11} color={selected ? color : colors.mutedForeground} />}
                <Text style={[styles.filterChipText, { color: selected ? color : colors.mutedForeground }]}>
                  {cat === 'all' ? 'Todos' : meta!.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Itens */}
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="repeat-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nenhuma recorrência encontrada
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Adicione transações com recorrência mensal, semanal ou anual na tela principal para que apareçam aqui automaticamente.
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => {
            const meta = CATEGORY_META[item.category]
            const isOverridden = !!recurringOverrides[item.groupId]
            return (
              <View key={item.groupId} style={[styles.expenseItem, { borderBottomColor: colors.border }]}>
                {/* Ícone do tipo */}
                <View style={[styles.itemIcon, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons
                    name={item.type === 'transferencia' ? 'swap-horizontal-outline' : 'receipt-outline'}
                    size={18}
                    color={meta.color}
                  />
                </View>

                {/* Detalhes */}
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <View style={styles.itemMeta}>
                    {/* Tipo de recorrência */}
                    <View style={[styles.recurrencePill, { backgroundColor: colors.muted }]}>
                      <Ionicons name="repeat-outline" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.recurrencePillText, { color: colors.mutedForeground }]}>
                        {RECURRENCE_LABEL[item.recurrence] ?? item.recurrence}
                      </Text>
                    </View>
                    {/* Conta de origem → destino */}
                    {item.type === 'transferencia' && item.targetAccountName ? (
                      <Text style={[styles.accountFlow, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {item.sourceAccountName} → {item.targetAccountName}
                      </Text>
                    ) : (
                      <Text style={[styles.accountFlow, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {item.sourceAccountName}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Valor + badge de categoria (tocável) */}
                <View style={styles.itemRight}>
                  <Text style={[styles.itemAmount, { color: colors.foreground }]}>
                    {fmt(item.amount)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.catBadge, { backgroundColor: meta.color + '18', borderColor: meta.color }]}
                    onPress={() => setPickerItem(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={meta.icon as any} size={10} color={meta.color} />
                    <Text style={[styles.catBadgeText, { color: meta.color }]}>{meta.label}</Text>
                    {isOverridden && (
                      <Ionicons name="pencil" size={9} color={meta.color} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}
      </View>

      <View style={{ height: 32 }} />

      {/* Modais */}
      <CategoryPickerModal
        visible={!!pickerItem}
        item={pickerItem}
        onClose={() => setPickerItem(null)}
        onSelect={handleCategorySelect}
        colors={colors}
      />
      <AllocationEditorModal
        visible={allocVisible}
        allocation={budgetAllocation}
        onClose={() => setAllocVisible(false)}
        onSave={saveBudgetAllocation}
        colors={colors}
      />
    </ScrollView>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Estilos
// ────────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  screenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  screenTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  screenSubtitle: { fontSize: 13, marginTop: 2 },
  configBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  incomeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14,
  },
  incomeCardLeft: { flexDirection: 'row', alignItems: 'center' },
  incomeLabel: { fontSize: 12 },
  incomeValue: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  incomeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  incomeBadgeText: { fontSize: 12, fontWeight: '600' },

  sectionCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  sectionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionCardTitle: { fontSize: 15, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 12 },

  stackedBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  stackedBarSegment: { height: '100%' },

  allocItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  allocDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  allocCenter: { flex: 1 },
  allocLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  miniBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },
  allocRight: { alignItems: 'flex-end', minWidth: 90 },
  allocPct: { fontSize: 13, fontWeight: '700' },
  allocVal: { fontSize: 13, fontWeight: '500', marginTop: 1 },
  allocDiff: { fontSize: 11, marginTop: 1 },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  summaryIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700' },
  summaryTotalValue: { fontSize: 16, fontWeight: '800' },

  listHeader: { marginBottom: 10 },
  listSubtitle: { fontSize: 12, marginTop: 2 },
  filterScroll: { marginBottom: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8,
  },
  filterChipText: { fontSize: 12, fontWeight: '500' },

  expenseItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  itemIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  recurrencePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  recurrencePillText: { fontSize: 10, fontWeight: '500' },
  accountFlow: { fontSize: 11, flexShrink: 1 },
  itemRight: { alignItems: 'flex-end', gap: 5 },
  itemAmount: { fontSize: 14, fontWeight: '700' },
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
  },
  catBadgeText: { fontSize: 11, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
})

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: 24 },
  sheet: { width: '100%', borderRadius: 20, padding: 20 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 16 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, marginBottom: 8,
  },
  optionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  cancelBtn: { marginTop: 4, borderTopWidth: 1, paddingTop: 14, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '500' },
})
