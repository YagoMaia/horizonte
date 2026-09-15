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
  Exclude<RecurringExpenseCategory, 'ignorado'>,
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

const CATEGORIES: Exclude<RecurringExpenseCategory, 'ignorado'>[] = ['investimento', 'fixo', 'variavel', 'outros']

// ────────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────────

interface BudgetItem {
  id: string
  description: string
  amount: number
  origin: 'recorrente' | 'avulso' | 'cartao'
  isInstallment?: boolean
  recurrence?: string
  date?: string
  paid?: boolean
  type: 'despesa' | 'transferencia'
  sourceAccountName: string
  targetAccountName?: string   // para transferências
  autoCategory: Exclude<RecurringExpenseCategory, 'ignorado'>
  category: Exclude<RecurringExpenseCategory, 'ignorado'> // final (auto ou override do usuário)
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
  item: BudgetItem | null
  onClose: () => void
  onSelect: (id: string, category: RecurringExpenseCategory) => void
  colors: any
}

function CategoryPickerModal({ visible, item, onClose, onSelect, colors }: CategoryPickerProps) {
  if (!item) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <View style={[pickerStyles.sheet, { backgroundColor: colors.card }]}>
          <Text style={[pickerStyles.title, { color: colors.foreground }]}>
            Classificar no Orçamento
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
                  onSelect(item.id, cat)
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

          {/* Opção para ignorar/remover completamente do orçamento */}
          <TouchableOpacity
            style={[
              pickerStyles.option,
              {
                backgroundColor: '#D32F2F12',
                borderColor: '#D32F2F',
                borderWidth: 1,
                marginTop: 4,
              },
            ]}
            onPress={() => {
              onSelect(item.id, 'ignorado')
              onClose()
            }}
            activeOpacity={0.7}
          >
            <View style={[pickerStyles.optionIcon, { backgroundColor: '#D32F2F20' }]}>
              <Ionicons name="eye-off-outline" size={18} color="#D32F2F" />
            </View>
            <Text style={[pickerStyles.optionLabel, { color: '#D32F2F' }]}>
              Ignorar no Orçamento
            </Text>
          </TouchableOpacity>

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
  const [pickerItem, setPickerItem] = useState<BudgetItem | null>(null)
  const [filterCategory, setFilterCategory] = useState<Exclude<RecurringExpenseCategory, 'ignorado'> | 'all'>('all')

  // ── Seletor de mês ───────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return { month: d.getMonth(), year: d.getFullYear() }
  })

  const now = new Date()
  const isCurrentMonth =
    selectedDate.month === now.getMonth() && selectedDate.year === now.getFullYear()
  const isFutureMonth =
    selectedDate.year > now.getFullYear() ||
    (selectedDate.year === now.getFullYear() && selectedDate.month > now.getMonth())

  const handlePrevMonth = () => {
    setSelectedDate(prev => {
      if (prev.month === 0) return { month: 11, year: prev.year - 1 }
      return { month: prev.month - 1, year: prev.year }
    })
  }
  const handleNextMonth = () => {
    setSelectedDate(prev => {
      if (prev.month === 11) return { month: 0, year: prev.year + 1 }
      return { month: prev.month + 1, year: prev.year }
    })
  }

  const MONTH_NAMES = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  ]
  const monthLabel = `${MONTH_NAMES[selectedDate.month]} ${selectedDate.year}`

  // ── Receitas do mês selecionado ──────────────────────────────────────────────
  // Calcula receitas pagas e a receber para o mês selecionado
  const incomeSummary = useMemo(() => {
    let paid = 0
    let pending = 0

    transactions.forEach(tx => {
      if (tx.type !== 'receita') return
      const d = new Date(tx.date)
      if (d.getMonth() === selectedDate.month && d.getFullYear() === selectedDate.year) {
        if (tx.paid) {
          paid += tx.amount
        } else {
          pending += tx.amount
        }
      }
    })

    const total = paid + pending
    return { paid, pending, total }
  }, [transactions, selectedDate])

  const selectedMonthIncome = incomeSummary.total

  // ── Composição dos gastos e transferências do mês ───────────────────────────
  const detectedItems = useMemo((): BudgetItem[] => {
    const items: BudgetItem[] = []

    for (const tx of transactions) {
      if (tx.type === 'receita') continue
      // Ignora lançamento de pagamento de fatura para não duplicar com as compras no cartão
      if (tx.description?.startsWith('Pagamento Fatura')) continue

      const sourceAcc = accounts.find(a => a.id === tx.accountId)
      const sourceAccountName = sourceAcc?.name ?? 'Conta'
      const isCard = tx.paymentMethod === 'credito' || sourceAcc?.type === 'cartao_credito'

      // Detecta se é compra parcelada (ex: totalInstallments > 1 ou terminada em "(1/10)")
      const isInstallment = Boolean(
        (tx.totalInstallments && tx.totalInstallments > 1) ||
        /\(\d+\/\d+\)$/.test(tx.description.trim())
      )

      if (isCard) {
        // Verifica se a compra cai na fatura do mês selecionado
        const closingDay = sourceAcc?.closingDay || 25
        const dueDay = sourceAcc?.dueDay || 5
        const d = new Date(tx.date)
        let m = d.getMonth() + 1
        let y = d.getFullYear()
        if (d.getDate() >= closingDay) m += 1
        if (dueDay < closingDay) m += 1
        while (m > 12) {
          m -= 12
          y += 1
        }
        const invoiceMonth = m - 1
        const invoiceYear = y

        if (invoiceMonth === selectedDate.month && invoiceYear === selectedDate.year) {
          let autoCategory: RecurringExpenseCategory = 'variavel'
          let origin: 'recorrente' | 'avulso' | 'cartao' = 'cartao'

          if (tx.recurrence && tx.recurrence !== 'unica') {
            autoCategory = 'fixo'
            origin = 'recorrente'
          } else if (isInstallment) {
            // Compras parceladas entram inicialmente como 'outros' (10%)
            autoCategory = 'outros'
          }

          const itemKey = tx.groupId || tx.id
          const category = recurringOverrides[itemKey] ?? recurringOverrides[tx.id] ?? autoCategory
          if (category === 'ignorado') continue

          items.push({
            id: tx.id,
            description: tx.description,
            amount: tx.amount,
            origin,
            isInstallment,
            recurrence: tx.recurrence,
            date: tx.date,
            paid: tx.paid,
            type: tx.type as 'despesa' | 'transferencia',
            sourceAccountName,
            autoCategory,
            category,
          })
        }
      } else {
        // Transação avulsa ou recorrente no débito/pix/dinheiro ou transferência
        const d = new Date(tx.date)
        if (d.getMonth() === selectedDate.month && d.getFullYear() === selectedDate.year) {
          let autoCategory: RecurringExpenseCategory = 'variavel'
          let targetAccountName: string | undefined
          let origin: 'recorrente' | 'avulso' | 'cartao' = 'avulso'

          if (tx.type === 'transferencia') {
            const destId = tx.targetAccountId ?? tx.toAccountId
            if (destId?.startsWith('goal_')) {
              autoCategory = 'investimento'
              targetAccountName = 'Meta de Poupança'
            } else {
              const destAcc = accounts.find(a => a.id === destId)
              targetAccountName = destAcc?.name
              if (destAcc?.type === 'investimento') {
                autoCategory = 'investimento'
              } else {
                // Transferência entre contas correntes/carteiras próprias é neutra:
                const explicit = recurringOverrides[tx.groupId || tx.id] ?? recurringOverrides[tx.id]
                if (!explicit || explicit === 'outros' || explicit === 'ignorado') {
                  continue
                }
                autoCategory = explicit
              }
            }
          } else {
            // Despesa
            if (tx.recurrence && tx.recurrence !== 'unica') {
              autoCategory = 'fixo'
              origin = 'recorrente'
            } else if (isInstallment) {
              // Compras parceladas entram inicialmente como 'outros' (10%)
              autoCategory = 'outros'
            }
          }

          const itemKey = tx.groupId || tx.id
          const category = recurringOverrides[itemKey] ?? recurringOverrides[tx.id] ?? autoCategory
          if (category === 'ignorado') continue

          items.push({
            id: tx.id,
            description: tx.description,
            amount: tx.amount,
            origin,
            isInstallment,
            recurrence: tx.recurrence,
            date: tx.date,
            paid: tx.paid,
            type: tx.type as 'despesa' | 'transferencia',
            sourceAccountName,
            targetAccountName,
            autoCategory,
            category,
          })
        }
      }
    }

    return items
  }, [transactions, accounts, recurringOverrides, selectedDate])

  // ── Totais por categoria ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat] = detectedItems
        .filter(i => i.category === cat)
        .reduce((s, i) => s + i.amount, 0)
      return acc
    }, {} as Record<Exclude<RecurringExpenseCategory, 'ignorado'>, number>)
  }, [detectedItems])

  const totalCommitted = useMemo(
    () => Object.values(totals).reduce((a, b) => a + b, 0),
    [totals],
  )

  // ── Renda de referência ──────────────────────────────────────────────────────
  // Prefere a receita real/projetada do mês; se zero, usa total comprometido
  const referenceIncome = selectedMonthIncome > 0 ? selectedMonthIncome : totalCommitted

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
    (id: string, category: RecurringExpenseCategory) => {
      saveRecurringOverride(id, category)
    },
    [saveRecurringOverride],
  )

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Cabeçalho com seletor de mês ── */}
      <View style={styles.screenHeader}>
        <TouchableOpacity
          style={[styles.configBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => setAllocVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Configurar distribuição do orçamento"
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Navegador de mês */}
      <View style={[styles.monthNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.monthNavCenter}
          onPress={() => setSelectedDate({ month: now.getMonth(), year: now.getFullYear() })}
          activeOpacity={0.7}
        >
          <Text style={[styles.monthNavLabel, { color: colors.foreground }]}>{monthLabel}</Text>
          {isCurrentMonth && (
            <View style={[styles.currentMonthBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.currentMonthBadgeText, { color: colors.primary }]}>Mês atual</Text>
            </View>
          )}
          {isFutureMonth && (
            <View style={[styles.currentMonthBadge, { backgroundColor: '#F57C0020' }]}>
              <Text style={[styles.currentMonthBadgeText, { color: '#F57C00' }]}>Projeção</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn} activeOpacity={0.6}>
          <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* ── Renda de referência ── */}
      <View style={[styles.incomeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Top Header Row */}
        <View style={styles.incomeCardHeader}>
          <View style={styles.incomeCardTitleRow}>
            <View style={[styles.incomeIconWrap, { backgroundColor: '#388E3C18' }]}>
              <Ionicons name="cash-outline" size={16} color="#388E3C" />
            </View>
            <Text style={[styles.incomeLabel, { color: colors.mutedForeground }]}>
              {incomeSummary.total > 0
                ? isFutureMonth ? 'Receitas previstas' : 'Receitas do mês'
                : 'Total de referência'}
            </Text>
          </View>
          <View style={[styles.incomeBadge, {
            backgroundColor: incomeSummary.total > 0
              ? incomeSummary.pending === 0 ? '#388E3C20' : '#F57C0020'
              : '#73737320',
          }]}>
            <Text style={[styles.incomeBadgeText, {
              color: incomeSummary.total > 0
                ? incomeSummary.pending === 0 ? '#388E3C' : '#F57C00'
                : colors.mutedForeground,
            }]}>
              {incomeSummary.total > 0
                ? incomeSummary.pending === 0 ? 'Realizado' : 'Previsto'
                : 'Estimado'}
            </Text>
          </View>
        </View>

        {/* Big Amount */}
        <Text style={[styles.incomeValue, { color: colors.foreground }]}>
          {fmt(referenceIncome)}
        </Text>

        {/* Breakdown de recebido vs a receber (se houver divisão no mês) */}
        {incomeSummary.total > 0 && incomeSummary.pending > 0 && incomeSummary.paid > 0 && (
          <View style={[styles.incomeBreakdownRow, { borderTopColor: colors.border }]}>
            <View style={styles.incomeBreakdownItem}>
              <View style={[styles.incomeDot, { backgroundColor: '#388E3C' }]} />
              <Text style={[styles.incomeBreakdownText, { color: colors.mutedForeground }]}>
                {fmt(incomeSummary.paid)} recebido
              </Text>
            </View>
            <View style={styles.incomeBreakdownItem}>
              <View style={[styles.incomeDot, { backgroundColor: '#F57C00' }]} />
              <Text style={[styles.incomeBreakdownText, { color: colors.mutedForeground }]}>
                {fmt(incomeSummary.pending)} a receber
              </Text>
            </View>
          </View>
        )}
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
          const actual = totals[key] ?? 0
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

      {/* ── Resumo de Gastos do Mês ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>Total por Categoria no Mês</Text>
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
          <Text style={[styles.summaryTotalLabel, { color: colors.foreground }]}>Total de saídas do mês</Text>
          <Text style={[styles.summaryTotalValue, { color: colors.foreground }]}>{fmt(totalCommitted)}</Text>
        </View>
      </View>

      {/* ── Lista de gastos e transferências do mês ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.listHeader}>
          <View>
            <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>Gastos & Saídas do Mês</Text>
            <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>
              Recorrências, compras no cartão e gastos avulsos
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
            <Ionicons name="receipt-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nenhum gasto encontrado neste mês
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Lançamentos avulsos, compras no cartão ou recorrências cadastradas aparecerão aqui automaticamente.
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => {
            const meta = CATEGORY_META[item.category]
            const isOverridden = !!recurringOverrides[item.id]
            
            // Status de pagamento (Pago vs A pagar)
            const isPaid = item.paid ?? false
            const statusLabel = isPaid ? 'Pago' : 'A pagar'
            const statusIcon = isPaid ? 'checkmark-circle-outline' : 'time-outline'
            const statusBg = isPaid ? '#388E3C18' : '#F57C0018'
            const statusTextColor = isPaid ? '#388E3C' : '#F57C00'

            return (
              <View key={item.id} style={[styles.expenseItem, { borderBottomColor: colors.border }]}>
                {/* Ícone do tipo */}
                <View style={[styles.itemIcon, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                </View>

                {/* Detalhes */}
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <View style={styles.itemMeta}>
                    {/* Badge de status (Pago vs A pagar) */}
                    <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                      <Ionicons name={statusIcon as any} size={10} color={statusTextColor} />
                      <Text style={[styles.statusPillText, { color: statusTextColor }]}>
                        {statusLabel}
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
  content: { padding: 20, paddingBottom: 32 },

  screenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  screenTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  configBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Navegador de mês
  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, marginBottom: 14,
    overflow: 'hidden',
  },
  monthNavBtn: { padding: 14 },
  monthNavCenter: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  monthNavLabel: { fontSize: 16, fontWeight: '700' },
  currentMonthBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 20 },
  currentMonthBadgeText: { fontSize: 11, fontWeight: '600' },

  incomeCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14,
  },
  incomeCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  incomeCardTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8,
  },
  incomeIconWrap: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  incomeLabel: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  incomeValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  incomeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  incomeBadgeText: { fontSize: 12, fontWeight: '600' },
  incomeBreakdownRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 12, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  incomeBreakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  incomeDot: { width: 6, height: 6, borderRadius: 3 },
  incomeBreakdownText: { fontSize: 12, fontWeight: '500' },

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
  recurrencePillText: { fontSize: 10, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: '600' },
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
