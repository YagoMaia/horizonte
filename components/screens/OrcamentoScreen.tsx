// components/screens/OrcamentoScreen.tsx
import React, { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useStoreContext } from '@/context/StoreContext'
import { RecurringExpense, RecurringExpenseCategory, BudgetAllocation } from '@/constants/types'

// ────────────────────────────────────────────────────────────────────────────────
// Dados estáticos auxiliares
// ────────────────────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  RecurringExpenseCategory,
  { label: string; icon: string; defaultColor: string }
> = {
  fixo:        { label: 'Fixo',        icon: 'home-outline',          defaultColor: '#1976D2' },
  variavel:    { label: 'Variável',    icon: 'swap-horizontal-outline', defaultColor: '#F57C00' },
  investimento:{ label: 'Investimento',icon: 'trending-up-outline',   defaultColor: '#388E3C' },
  outros:      { label: 'Outros',      icon: 'ellipsis-horizontal-outline', defaultColor: '#7B1FA2' },
}

const ALLOCATION_META: Record<
  keyof BudgetAllocation,
  { label: string; color: string; icon: string }
> = {
  investimento: { label: 'Investimentos', color: '#388E3C', icon: 'trending-up-outline' },
  fixo:         { label: 'Gastos Fixos',  color: '#1976D2', icon: 'home-outline' },
  variavel:     { label: 'Gastos Variáveis', color: '#F57C00', icon: 'swap-horizontal-outline' },
  outros:       { label: 'Outras Demandas', color: '#7B1FA2', icon: 'ellipsis-horizontal-outline' },
}

const ICON_OPTIONS = [
  'home-outline', 'car-outline', 'heart-outline', 'phone-portrait-outline',
  'wifi-outline', 'water-outline', 'flash-outline', 'restaurant-outline',
  'fitness-outline', 'musical-notes-outline', 'book-outline', 'school-outline',
  'trending-up-outline', 'shield-outline', 'medical-outline', 'paw-outline',
  'basket-outline', 'shirt-outline', 'bus-outline', 'airplane-outline',
  'tv-outline', 'game-controller-outline', 'umbrella-outline', 'gift-outline',
]

const CATEGORIES: RecurringExpenseCategory[] = ['fixo', 'variavel', 'investimento', 'outros']

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function allocationSum(alloc: BudgetAllocation): number {
  return alloc.investimento + alloc.fixo + alloc.variavel + alloc.outros
}

// ────────────────────────────────────────────────────────────────────────────────
// Subcomponente: ExpenseFormModal
// ────────────────────────────────────────────────────────────────────────────────

interface ExpenseFormModalProps {
  visible: boolean
  editing: RecurringExpense | null
  onClose: () => void
  onSave: (expense: Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt'>) => void
  colors: any
}

function ExpenseFormModal({ visible, editing, onClose, onSave, colors }: ExpenseFormModalProps) {
  const [name, setName] = useState(editing?.name ?? '')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [category, setCategory] = useState<RecurringExpenseCategory>(editing?.category ?? 'fixo')
  const [icon, setIcon] = useState(editing?.icon ?? 'home-outline')
  const [dueDay, setDueDay] = useState(editing?.dueDay ? String(editing.dueDay) : '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [active, setActive] = useState(editing?.active ?? true)
  const [showIcons, setShowIcons] = useState(false)

  // Sync state when editing changes
  React.useEffect(() => {
    if (editing) {
      setName(editing.name)
      setAmount(String(editing.amount))
      setCategory(editing.category)
      setIcon(editing.icon)
      setDueDay(editing.dueDay ? String(editing.dueDay) : '')
      setNotes(editing.notes ?? '')
      setActive(editing.active)
    } else {
      setName('')
      setAmount('')
      setCategory('fixo')
      setIcon('home-outline')
      setDueDay('')
      setNotes('')
      setActive(true)
    }
    setShowIcons(false)
  }, [editing, visible])

  const handleSave = () => {
    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (!name.trim()) { Alert.alert('Atenção', 'Informe um nome para o gasto.'); return }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { Alert.alert('Atenção', 'Informe um valor válido.'); return }
    const parsedDay = dueDay ? parseInt(dueDay, 10) : undefined
    if (parsedDay !== undefined && (parsedDay < 1 || parsedDay > 31)) {
      Alert.alert('Atenção', 'Dia de vencimento deve ser entre 1 e 31.'); return
    }
    onSave({
      name: name.trim(),
      amount: parsedAmount,
      category,
      icon,
      color: CATEGORY_META[category].defaultColor,
      dueDay: parsedDay,
      notes: notes.trim() || undefined,
      active,
    })
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.formSheet, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {editing ? 'Editar Gasto' : 'Novo Gasto Recorrente'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Nome */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Nome *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Aluguel, Netflix..."
              placeholderTextColor={colors.mutedForeground}
            />

            {/* Valor */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Valor Mensal *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0,00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />

            {/* Categoria */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Categoria *</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat]
                const selected = category === cat
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selected ? meta.defaultColor + '20' : colors.secondary,
                        borderColor: selected ? meta.defaultColor : colors.border,
                        borderWidth: selected ? 1.5 : 1,
                      },
                    ]}
                    onPress={() => { setCategory(cat); setIcon(meta.icon) }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={meta.icon as any} size={16} color={selected ? meta.defaultColor : colors.mutedForeground} />
                    <Text style={[styles.categoryChipText, { color: selected ? meta.defaultColor : colors.mutedForeground }]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Ícone */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Ícone</Text>
            <TouchableOpacity
              style={[styles.iconPicker, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => setShowIcons((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons name={icon as any} size={22} color={CATEGORY_META[category].defaultColor} />
              <Text style={[styles.iconPickerText, { color: colors.foreground }]}>{icon.replace(/-outline$/, '').replace(/-/g, ' ')}</Text>
              <Ionicons name={showIcons ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showIcons && (
              <View style={[styles.iconGrid, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                {ICON_OPTIONS.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconOption, icon === ic && { backgroundColor: CATEGORY_META[category].defaultColor + '25', borderRadius: 8 }]}
                    onPress={() => { setIcon(ic); setShowIcons(false) }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={ic as any} size={22} color={icon === ic ? CATEGORY_META[category].defaultColor : colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Dia de vencimento */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Dia de Vencimento (opcional)</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={dueDay}
              onChangeText={setDueDay}
              placeholder="Ex: 10"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={2}
            />

            {/* Notas */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Observações (opcional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalhes sobre este gasto..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />

            {/* Ativo */}
            <TouchableOpacity
              style={[styles.toggleRow, { borderColor: colors.border }]}
              onPress={() => setActive((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Ativo no orçamento</Text>
              <View style={[styles.toggle, { backgroundColor: active ? '#388E3C' : colors.muted }]}>
                <View style={[styles.toggleKnob, { transform: [{ translateX: active ? 18 : 2 }] }]} />
              </View>
            </TouchableOpacity>

            {/* Botão salvar */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: CATEGORY_META[category].defaultColor }]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>
                {editing ? 'Salvar Alterações' : 'Adicionar Gasto'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Subcomponente: AllocationEditorModal
// ────────────────────────────────────────────────────────────────────────────────

interface AllocationEditorProps {
  visible: boolean
  allocation: BudgetAllocation
  onClose: () => void
  onSave: (a: BudgetAllocation) => void
  colors: any
}

function AllocationEditorModal({ visible, allocation, onClose, onSave, colors }: AllocationEditorProps) {
  const [investimento, setInvestimento] = useState(String(allocation.investimento))
  const [fixo, setFixo] = useState(String(allocation.fixo))
  const [variavel, setVariavel] = useState(String(allocation.variavel))
  const [outros, setOutros] = useState(String(allocation.outros))

  React.useEffect(() => {
    if (visible) {
      setInvestimento(String(allocation.investimento))
      setFixo(String(allocation.fixo))
      setVariavel(String(allocation.variavel))
      setOutros(String(allocation.outros))
    }
  }, [visible, allocation])

  const total = useMemo(() => {
    const sum = [investimento, fixo, variavel, outros]
      .map((v) => parseFloat(v) || 0)
      .reduce((a, b) => a + b, 0)
    return Math.round(sum * 10) / 10
  }, [investimento, fixo, variavel, outros])

  const handleSave = () => {
    const vals = {
      investimento: parseFloat(investimento) || 0,
      fixo: parseFloat(fixo) || 0,
      variavel: parseFloat(variavel) || 0,
      outros: parseFloat(outros) || 0,
    }
    if (Math.abs(total - 100) > 0.1) {
      Alert.alert('Atenção', `A soma dos percentuais deve ser 100%. Atual: ${total}%`)
      return
    }
    onSave(vals)
    onClose()
  }

  const renderField = (label: string, value: string, setter: (v: string) => void, color: string) => (
    <View style={styles.allocRow} key={label}>
      <Text style={[styles.allocRowLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.allocInputWrap, { borderColor: color, borderWidth: 1.5, backgroundColor: color + '12' }]}>
        <TextInput
          style={[styles.allocInput, { color: color }]}
          value={value}
          onChangeText={setter}
          keyboardType="decimal-pad"
          maxLength={5}
        />
        <Text style={[styles.allocPercent, { color: color }]}>%</Text>
      </View>
    </View>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.formSheet, { backgroundColor: colors.card }]}>
          <View style={styles.formHeader}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Configurar Divisão</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.allocHint, { color: colors.mutedForeground }]}>
            Defina como deseja dividir seus ganhos. A soma deve ser exatamente 100%.
          </Text>
          {renderField('Investimentos', investimento, setInvestimento, '#388E3C')}
          {renderField('Gastos Fixos', fixo, setFixo, '#1976D2')}
          {renderField('Gastos Variáveis', variavel, setVariavel, '#F57C00')}
          {renderField('Outras Demandas', outros, setOutros, '#7B1FA2')}
          <View style={[styles.allocTotal, { borderColor: Math.abs(total - 100) > 0.1 ? '#D32F2F' : '#388E3C' }]}>
            <Text style={[styles.allocTotalLabel, { color: colors.mutedForeground }]}>Total</Text>
            <Text style={[styles.allocTotalValue, { color: Math.abs(total - 100) > 0.1 ? '#D32F2F' : '#388E3C' }]}>
              {total}%
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: Math.abs(total - 100) > 0.1 ? colors.muted : '#388E3C' }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>Salvar Divisão</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Tela principal: OrcamentoScreen
// ────────────────────────────────────────────────────────────────────────────────

export function OrcamentoScreen() {
  const { colors } = useTheme()
  const store = useStoreContext()
  const { recurringExpenses, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
          budgetAllocation, saveBudgetAllocation, monthlyIncome } = store

  const [formVisible, setFormVisible] = useState(false)
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null)
  const [allocVisible, setAllocVisible] = useState(false)
  const [filterCategory, setFilterCategory] = useState<RecurringExpenseCategory | 'all'>('all')

  // Totais por categoria (apenas ativos)
  const totals = useMemo(() => {
    const active = recurringExpenses.filter((e) => e.active)
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat] = active.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0)
      return acc
    }, {} as Record<RecurringExpenseCategory, number>)
  }, [recurringExpenses])

  const totalFixed = useMemo(
    () => Object.values(totals).reduce((a, b) => a + b, 0),
    [totals],
  )

  // Renda de referência: usa monthlyIncome do store ou totalFixed (fallback)
  const referenceIncome = monthlyIncome > 0 ? monthlyIncome : totalFixed

  // Alocação teórica
  const theoreticalAlloc = useMemo((): Record<keyof BudgetAllocation, number> => ({
    investimento: (referenceIncome * budgetAllocation.investimento) / 100,
    fixo:         (referenceIncome * budgetAllocation.fixo) / 100,
    variavel:     (referenceIncome * budgetAllocation.variavel) / 100,
    outros:       (referenceIncome * budgetAllocation.outros) / 100,
  }), [referenceIncome, budgetAllocation])

  const filteredExpenses = useMemo(() =>
    filterCategory === 'all'
      ? recurringExpenses
      : recurringExpenses.filter((e) => e.category === filterCategory),
  [recurringExpenses, filterCategory])

  const handleDelete = useCallback((expense: RecurringExpense) => {
    Alert.alert(
      'Remover Gasto',
      `Deseja remover "${expense.name}" dos seus gastos recorrentes?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => deleteRecurringExpense(expense.id) },
      ],
    )
  }, [deleteRecurringExpense])

  const handleSaveExpense = useCallback(async (data: Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingExpense) {
      await updateRecurringExpense({ ...editingExpense, ...data, updatedAt: new Date().toISOString() })
    } else {
      await addRecurringExpense(data)
    }
    setEditingExpense(null)
  }, [editingExpense, addRecurringExpense, updateRecurringExpense])

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Cabeçalho ── */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Orçamento Mensal</Text>
          <Text style={[styles.screenSubtitle, { color: colors.mutedForeground }]}>
            Divisão teórica dos seus ganhos
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
              {monthlyIncome > 0 ? 'Receitas do mês' : 'Total de gastos fixos'}
            </Text>
            <Text style={[styles.incomeValue, { color: colors.foreground }]}>
              {fmt(referenceIncome)}
            </Text>
          </View>
        </View>
        <View style={[styles.incomeBadge, { backgroundColor: monthlyIncome > 0 ? '#388E3C20' : '#F57C0020' }]}>
          <Text style={[styles.incomeBadgeText, { color: monthlyIncome > 0 ? '#388E3C' : '#F57C00' }]}>
            {monthlyIncome > 0 ? 'Real' : 'Estimado'}
          </Text>
        </View>
      </View>

      {/* ── Painel de divisão teórica ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionCardHeader}>
          <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>Divisão Teórica</Text>
          <TouchableOpacity
            onPress={() => setAllocVisible(true)}
            style={styles.editAllocBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.editAllocBtnText, { color: colors.mutedForeground }]}>Editar</Text>
          </TouchableOpacity>
        </View>

        {/* Barra visual */}
        <View style={styles.stackedBar}>
          {(Object.keys(budgetAllocation) as (keyof BudgetAllocation)[]).map((key) => (
            <View
              key={key}
              style={[
                styles.stackedBarSegment,
                {
                  flex: budgetAllocation[key],
                  backgroundColor: ALLOCATION_META[key].color,
                },
              ]}
            />
          ))}
        </View>

        {/* Legenda */}
        {(Object.keys(budgetAllocation) as (keyof BudgetAllocation)[]).map((key) => {
          const meta = ALLOCATION_META[key]
          const theorical = theoreticalAlloc[key]
          const actual = key === 'fixo' ? totals.fixo : key === 'variavel' ? totals.variavel : key === 'investimento' ? totals.investimento : totals.outros
          const diff = theorical - actual
          const isOk = actual <= theorical
          return (
            <View key={key} style={[styles.allocItem, { borderBottomColor: colors.border }]}>
              <View style={[styles.allocDot, { backgroundColor: meta.color }]} />
              <View style={styles.allocItemCenter}>
                <Text style={[styles.allocItemLabel, { color: colors.foreground }]}>{meta.label}</Text>
                <View style={styles.allocItemBarWrap}>
                  <View style={[styles.allocItemBar, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.allocItemBarFill,
                        {
                          backgroundColor: meta.color,
                          width: `${Math.min(actual / Math.max(theorical, 1) * 100, 100)}%` as any,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
              <View style={styles.allocItemRight}>
                <Text style={[styles.allocItemPct, { color: meta.color }]}>
                  {budgetAllocation[key]}%
                </Text>
                <Text style={[styles.allocItemVal, { color: colors.foreground }]}>
                  {fmt(theorical)}
                </Text>
                {referenceIncome > 0 && (
                  <Text style={[styles.allocItemDiff, { color: isOk ? '#388E3C' : '#D32F2F' }]}>
                    {isOk ? `+${fmt(diff)} livre` : `${fmt(Math.abs(diff))} acima`}
                  </Text>
                )}
              </View>
            </View>
          )
        })}
      </View>

      {/* ── Resumo dos gastos recorrentes ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>Resumo de Gastos Fixos</Text>
        {CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat]
          return (
            <View key={cat} style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.summaryIcon, { backgroundColor: meta.defaultColor + '18' }]}>
                <Ionicons name={meta.icon as any} size={16} color={meta.defaultColor} />
              </View>
              <Text style={[styles.summaryLabel, { color: colors.foreground }]}>{meta.label}</Text>
              <Text style={[styles.summaryValue, { color: meta.defaultColor }]}>{fmt(totals[cat])}</Text>
            </View>
          )
        })}
        <View style={[styles.summaryTotalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.summaryTotalLabel, { color: colors.foreground }]}>Total Recorrente</Text>
          <Text style={[styles.summaryTotalValue, { color: colors.foreground }]}>{fmt(totalFixed)}</Text>
        </View>
      </View>

      {/* ── Lista de gastos ── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.listHeader}>
          <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>Gastos Recorrentes</Text>
          <TouchableOpacity
            style={[styles.addExpenseBtn, { backgroundColor: colors.primary }]}
            onPress={() => { setEditingExpense(null); setFormVisible(true) }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={styles.addExpenseBtnText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {/* Filtros por categoria */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {(['all', ...CATEGORIES] as const).map((cat) => {
            const selected = filterCategory === cat
            const meta = cat !== 'all' ? CATEGORY_META[cat] : null
            const color = meta ? meta.defaultColor : colors.primary
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? color + '20' : colors.secondary,
                    borderColor: selected ? color : colors.border,
                    borderWidth: selected ? 1.5 : 1,
                  },
                ]}
                onPress={() => setFilterCategory(cat as any)}
                activeOpacity={0.7}
              >
                {meta && <Ionicons name={meta.icon as any} size={12} color={selected ? color : colors.mutedForeground} />}
                <Text style={[styles.filterChipText, { color: selected ? color : colors.mutedForeground }]}>
                  {cat === 'all' ? 'Todos' : meta!.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Itens */}
        {filteredExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhum gasto recorrente{filterCategory !== 'all' ? ` em "${CATEGORY_META[filterCategory as RecurringExpenseCategory].label}"` : ''}.
            </Text>
            <TouchableOpacity
              style={[styles.emptyAddBtn, { borderColor: colors.primary }]}
              onPress={() => { setEditingExpense(null); setFormVisible(true) }}
            >
              <Text style={[styles.emptyAddBtnText, { color: colors.primary }]}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredExpenses.map((expense) => {
            const meta = CATEGORY_META[expense.category]
            return (
              <View
                key={expense.id}
                style={[styles.expenseItem, { borderBottomColor: colors.border, opacity: expense.active ? 1 : 0.45 }]}
              >
                <View style={[styles.expenseIcon, { backgroundColor: expense.color + '20' }]}>
                  <Ionicons name={expense.icon as any} size={20} color={expense.color} />
                </View>
                <View style={styles.expenseDetails}>
                  <View style={styles.expenseTopRow}>
                    <Text style={[styles.expenseName, { color: colors.foreground }]} numberOfLines={1}>
                      {expense.name}
                    </Text>
                    {!expense.active && (
                      <View style={[styles.inactiveBadge, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.inactiveBadgeText, { color: colors.mutedForeground }]}>Inativo</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.expenseMetaRow}>
                    <View style={[styles.catPill, { backgroundColor: meta.defaultColor + '18' }]}>
                      <Text style={[styles.catPillText, { color: meta.defaultColor }]}>{meta.label}</Text>
                    </View>
                    {expense.dueDay && (
                      <Text style={[styles.dueDayText, { color: colors.mutedForeground }]}>
                        Vence dia {expense.dueDay}
                      </Text>
                    )}
                  </View>
                  {expense.notes ? (
                    <Text style={[styles.expenseNotes, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {expense.notes}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.expenseRight}>
                  <Text style={[styles.expenseAmount, { color: colors.foreground }]}>
                    {fmt(expense.amount)}
                  </Text>
                  <View style={styles.expenseActions}>
                    <TouchableOpacity
                      onPress={() => { setEditingExpense(expense); setFormVisible(true) }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(expense)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginLeft: 14 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#D32F2F" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          })
        )}
      </View>

      {/* Espaço final */}
      <View style={{ height: 32 }} />

      {/* Modais */}
      <ExpenseFormModal
        visible={formVisible}
        editing={editingExpense}
        onClose={() => { setFormVisible(false); setEditingExpense(null) }}
        onSave={handleSaveExpense}
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
  contentContainer: { padding: 16, paddingBottom: 32 },

  // Header
  screenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  screenTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  screenSubtitle: { fontSize: 13, marginTop: 2 },
  configBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Income card
  incomeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14,
  },
  incomeCardLeft: { flexDirection: 'row', alignItems: 'center' },
  incomeLabel: { fontSize: 12 },
  incomeValue: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 1 },
  incomeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  incomeBadgeText: { fontSize: 12, fontWeight: '600' },

  // Section cards
  sectionCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  sectionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionCardTitle: { fontSize: 15, fontWeight: '700' },
  editAllocBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editAllocBtnText: { fontSize: 12 },

  // Stacked bar
  stackedBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  stackedBarSegment: { height: '100%' },

  // Allocation items
  allocItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  allocDot: { width: 8, height: 8, borderRadius: 4 },
  allocItemCenter: { flex: 1 },
  allocItemLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  allocItemBarWrap: { width: '100%' },
  allocItemBar: { height: 4, borderRadius: 2, width: '100%', overflow: 'hidden' },
  allocItemBarFill: { height: '100%', borderRadius: 2 },
  allocItemRight: { alignItems: 'flex-end', minWidth: 90 },
  allocItemPct: { fontSize: 13, fontWeight: '700' },
  allocItemVal: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  allocItemDiff: { fontSize: 11, marginTop: 1 },

  // Summary
  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  summaryIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, marginTop: 4,
  },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700' },
  summaryTotalValue: { fontSize: 16, fontWeight: '800' },

  // List
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addExpenseBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  addExpenseBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  // Filter scroll
  filterScroll: { marginBottom: 12 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginRight: 8,
  },
  filterChipText: { fontSize: 12, fontWeight: '500' },

  // Expense items
  expenseItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  expenseIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  expenseDetails: { flex: 1 },
  expenseTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  expenseName: { fontSize: 14, fontWeight: '600', flex: 1 },
  inactiveBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  inactiveBadgeText: { fontSize: 10, fontWeight: '500' },
  expenseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  catPillText: { fontSize: 11, fontWeight: '600' },
  dueDayText: { fontSize: 11 },
  expenseNotes: { fontSize: 11, marginTop: 2 },
  expenseRight: { alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  expenseActions: { flexDirection: 'row', alignItems: 'center' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  emptyAddBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
  emptyAddBtnText: { fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  formSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 17, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  textInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 15,
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  categoryChipText: { fontSize: 13, fontWeight: '500' },
  iconPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 10, padding: 12,
  },
  iconPickerText: { flex: 1, fontSize: 14, textTransform: 'capitalize' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 10, padding: 8, marginTop: 4, gap: 4 },
  iconOption: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '500' },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Allocation editor
  allocHint: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  allocRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  allocRowLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  allocInputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  allocInput: { fontSize: 18, fontWeight: '700', minWidth: 48, textAlign: 'right' },
  allocPercent: { fontSize: 16, fontWeight: '600', marginLeft: 2 },
  allocTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 10, padding: 12, marginVertical: 8,
  },
  allocTotalLabel: { fontSize: 14, fontWeight: '600' },
  allocTotalValue: { fontSize: 20, fontWeight: '800' },
})
