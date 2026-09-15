// components/screens/ReportsScreen.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useReportsData, PeriodMonths } from '@/hooks/useReportsData'
import { PeriodSelector } from './reports/PeriodSelector'
import { MonthlyEvolutionChart } from './reports/MonthlyEvolutionChart'
import { NetBalanceChart } from './reports/NetBalanceChart'
import { ComparativeSummaryCard } from './reports/ComparativeSummaryCard'
import { AveragesCard } from './reports/AveragesCard'
import { TopTransactionsSection } from './reports/TopTransactionsSection'

// ── Importações do conteúdo de Totais (reutilizado internamente) ──
import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { useStoreContext } from '@/context/StoreContext'
import { BalanceChart } from '../BalanceChart'

// ────────────────────────────────────────────────────────────────────────────────
// Sub-aba: Visão Geral (antigo TotaisScreen)
// ────────────────────────────────────────────────────────────────────────────────

type Period = 'semana' | 'mes' | 'ano'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function VisaoGeralTab() {
  const { colors } = useTheme()
  const { transactions, showPending } = useStoreContext()

  const [period, setPeriod] = useState<Period>('mes')
  const [refDate, setRefDate] = useState(new Date())

  const handlePrev = () => {
    const newDate = new Date(refDate)
    if (period === 'semana') newDate.setDate(newDate.getDate() - 7)
    else if (period === 'mes') newDate.setMonth(newDate.getMonth() - 1)
    else if (period === 'ano') newDate.setFullYear(newDate.getFullYear() - 1)
    setRefDate(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(refDate)
    if (period === 'semana') newDate.setDate(newDate.getDate() + 7)
    else if (period === 'mes') newDate.setMonth(newDate.getMonth() + 1)
    else if (period === 'ano') newDate.setFullYear(newDate.getFullYear() + 1)
    setRefDate(newDate)
  }

  const periodLabel = useMemo(() => {
    if (period === 'ano') return refDate.getFullYear().toString()
    if (period === 'mes') return `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`
    const start = new Date(refDate)
    start.setDate(start.getDate() - 6)
    const startStr = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].substring(0, 3)}`
    const endStr = `${refDate.getDate()} ${MONTH_NAMES[refDate.getMonth()].substring(0, 3)}`
    return `${startStr} - ${endStr}`
  }, [refDate, period])

  const filtered = useMemo(() => {
    const end = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999)
    const start = new Date(end)
    if (period === 'semana') {
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
    }
    return transactions.filter(tx => {
      if (!showPending && !tx.paid) return false
      const txDate = new Date(tx.date)
      if (period === 'semana') return txDate >= start && txDate <= end
      if (period === 'mes') return txDate.getMonth() === refDate.getMonth() && txDate.getFullYear() === refDate.getFullYear()
      return txDate.getFullYear() === refDate.getFullYear()
    })
  }, [transactions, period, showPending, refDate])

  const stats = useMemo(() => {
    const income = filtered.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0)
    const expense = filtered.filter(t => {
      if (t.type !== 'despesa') return false
      if (t.paymentMethod === 'credito') return false
      return true
    }).reduce((s, t) => s + t.amount, 0)
    const performance = income - expense
    const economizadoPercent = income > 0 ? Math.max(0, (performance / income) * 100) : 0
    const now = new Date()
    let days = 1
    if (period === 'semana') {
      days = 7
    } else if (period === 'mes') {
      const isCurrentMonth = refDate.getMonth() === now.getMonth() && refDate.getFullYear() === now.getFullYear()
      days = isCurrentMonth ? now.getDate() : new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()
    } else {
      const isCurrentYear = refDate.getFullYear() === now.getFullYear()
      if (isCurrentYear) {
        const startOfYear = new Date(now.getFullYear(), 0, 0)
        days = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) || 1
      } else {
        days = 365
      }
    }
    return { income, expense, performance, economizadoPercent, diarioMedio: expense / days }
  }, [filtered, period, refDate])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={vStyles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Seletor de Período */}
      <View style={[vStyles.segmented, { backgroundColor: colors.secondary }]}>
        {(['semana', 'mes', 'ano'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[vStyles.segBtn, period === p && { backgroundColor: colors.card }]}
            onPress={() => { setPeriod(p); setRefDate(new Date()) }}
          >
            <Text style={[vStyles.segBtnText, { color: period === p ? colors.foreground : colors.mutedForeground }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Navegador de Tempo */}
      <View style={[vStyles.periodNav, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={handlePrev} style={vStyles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[vStyles.periodTitle, { color: colors.foreground }]}>{periodLabel}</Text>
        <TouchableOpacity onPress={handleNext} style={vStyles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Indicadores */}
      <Text style={[vStyles.sectionTitle, { color: colors.mutedForeground }]}>Cálculos do período</Text>
      <View style={[vStyles.statsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={vStyles.statRow}>
          <View>
            <Text style={[vStyles.statLabel, { color: colors.foreground }]}>Performance</Text>
            <View style={vStyles.iconRow}>
              <Ionicons name="arrow-down-circle" size={14} color={colors.destructive} />
              <Ionicons name="arrow-up-circle" size={14} color={colors.success} />
            </View>
          </View>
          <View style={vStyles.statRight}>
            <Text style={[vStyles.statValue, { color: stats.performance >= 0 ? colors.success : colors.destructive }]}>
              {formatCurrency(stats.performance)}
            </Text>
            <Text style={[vStyles.statStatus, { color: colors.mutedForeground }]}>
              {stats.performance >= 0 ? 'Sobrou dinheiro' : 'Faltou dinheiro'}
            </Text>
          </View>
        </View>

        <View style={[vStyles.statRow, vStyles.borderTop, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[vStyles.statLabel, { color: colors.foreground }]}>Economizado</Text>
            <View style={vStyles.iconRow}>
              <Ionicons name="leaf-outline" size={14} color={colors.success} />
            </View>
          </View>
          <View style={vStyles.statRight}>
            <Text style={[vStyles.statValue, { color: colors.foreground }]}>{stats.economizadoPercent.toFixed(0)}%</Text>
            <Text style={[vStyles.statStatus, { color: colors.mutedForeground }]}>
              {stats.economizadoPercent > 0 ? 'Guardado' : 'Nada guardado'}
            </Text>
          </View>
        </View>

        <View style={[vStyles.statRow, vStyles.borderTop, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[vStyles.statLabel, { color: colors.foreground }]}>Custo de vida</Text>
            <View style={vStyles.iconRow}>
              <Ionicons name="cart-outline" size={14} color={colors.primaryText} />
            </View>
          </View>
          <View style={vStyles.statRight}>
            <Text style={[vStyles.statValue, { color: colors.foreground }]}>{formatCurrency(stats.expense)}</Text>
            <Text style={[vStyles.statStatus, { color: colors.mutedForeground }]}>
              {stats.expense > stats.income ? 'Acima da renda' : 'Dentro da renda'}
            </Text>
          </View>
        </View>

        <View style={[vStyles.statRow, vStyles.borderTop, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[vStyles.statLabel, { color: colors.foreground }]}>Diário médio</Text>
            <View style={vStyles.iconRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
            </View>
          </View>
          <View style={vStyles.statRight}>
            <Text style={[vStyles.statValue, { color: colors.foreground }]}>{formatCurrency(stats.diarioMedio)}</Text>
            <Text style={[vStyles.statStatus, { color: colors.mutedForeground }]}>Média de gastos</Text>
          </View>
        </View>
      </View>

      {/* Gráfico de saldo */}
      <BalanceChart transactions={transactions} period={period} refDate={refDate} />
    </ScrollView>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Sub-aba: Relatórios (antigo ReportsScreen)
// ────────────────────────────────────────────────────────────────────────────────

function RelatoriosTab() {
  const { colors } = useTheme()
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodMonths>(6)

  const { monthlyData, comparativeSummary, averages, topExpenses, topIncomes, isEmpty, isLoading } =
    useReportsData(selectedPeriod)

  if (isLoading) {
    return (
      <View style={[rStyles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primaryText} />
        <Text style={[rStyles.loadingText, { color: colors.mutedForeground }]}>
          Carregando relatórios...
        </Text>
      </View>
    )
  }

  if (isEmpty) {
    return (
      <View style={[rStyles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="stats-chart-outline" size={48} color={colors.mutedForeground} />
        <Text style={[rStyles.emptyText, { color: colors.mutedForeground }]}>
          Adicione transações para ver seus relatórios
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={[rStyles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={rStyles.content}
      showsVerticalScrollIndicator={false}
    >
      <PeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />
      <MonthlyEvolutionChart monthlyData={monthlyData} />
      <NetBalanceChart monthlyData={monthlyData} />
      <ComparativeSummaryCard comparativeSummary={comparativeSummary} />
      <View style={rStyles.spacer} />
      <AveragesCard averages={averages} />
      <View style={rStyles.spacer} />
      <TopTransactionsSection topExpenses={topExpenses} topIncomes={topIncomes} />
    </ScrollView>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Tela unificada: ReportsScreen (com abas internas)
// ────────────────────────────────────────────────────────────────────────────────

type InternalTab = 'visao' | 'relatorios'

const INTERNAL_TABS: { id: InternalTab; label: string; icon: string }[] = [
  { id: 'visao',      label: 'Visão Geral', icon: 'bar-chart-outline' },
  { id: 'relatorios', label: 'Relatórios',  icon: 'stats-chart-outline' },
]

export function ReportsScreen() {
  const { colors } = useTheme()
  const [activeTab, setActiveTab] = useState<InternalTab>('visao')

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Tabs internas */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {INTERNAL_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, isActive && { borderBottomColor: colors.primary }]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={isActive ? colors.primaryText : colors.mutedForeground}
              />
              <Text style={[styles.tabLabel, { color: isActive ? colors.primaryText : colors.mutedForeground }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Conteúdo da sub-aba ativa */}
      {activeTab === 'visao' ? <VisaoGeralTab /> : <RelatoriosTab />}
    </View>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Estilos da tela unificada
// ────────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
})

// ────────────────────────────────────────────────────────────────────────────────
// Estilos internos — VisaoGeralTab
// ────────────────────────────────────────────────────────────────────────────────

const vStyles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnText: { fontSize: 13, fontWeight: '600' },
  periodNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  periodTitle: { fontSize: 16, fontWeight: '700' },
  navBtn: { padding: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginLeft: 4 },
  statsContainer: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  borderTop: { borderTopWidth: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 15, fontWeight: '600' },
  iconRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  statRight: { alignItems: 'flex-end' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statStatus: { fontSize: 12, marginTop: 2 },
})

// ────────────────────────────────────────────────────────────────────────────────
// Estilos internos — RelatoriosTab
// ────────────────────────────────────────────────────────────────────────────────

const rStyles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  emptyText: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  spacer: { height: 16 },
})
