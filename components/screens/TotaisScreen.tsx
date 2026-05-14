// components/screens/TotaisScreen.tsx
import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency } from '@/lib/utils'
import { useStoreContext } from '@/context/StoreContext'
import { startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'

// 👉 IMPORTANDO O GRÁFICO AQUI
import { CategoryDonutChart } from '../CategoryDonutChart'

type Period = 'semana' | 'mes' | 'ano'
type ChartFilter = 'debito' | 'credito' | 'total'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function TotaisScreen() {
  const { colors } = useTheme()
  const { transactions, showPending } = useStoreContext()

  const [period, setPeriod] = useState<Period>('mes')
  const [selectedChart, setSelectedChart] = useState<ChartFilter>('total')

  const [refDate, setRefDate] = useState(new Date())

  const handlePrev = () => {
    let newDate = new Date(refDate)
    if (period === 'semana') newDate = subWeeks(newDate, 1)
    else if (period === 'mes') newDate.setMonth(newDate.getMonth() - 1)
    else if (period === 'ano') newDate.setFullYear(newDate.getFullYear() - 1)
    setRefDate(newDate)
  }

  const handleNext = () => {
    let newDate = new Date(refDate)
    if (period === 'semana') newDate = addWeeks(newDate, 1)
    else if (period === 'mes') newDate.setMonth(newDate.getMonth() + 1)
    else if (period === 'ano') newDate.setFullYear(newDate.getFullYear() + 1)
    setRefDate(newDate)
  }

  const periodLabel = useMemo(() => {
    if (period === 'ano') return refDate.getFullYear().toString()
    if (period === 'mes') return `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`

    const start = startOfWeek(refDate)
    const end = endOfWeek(refDate)

    const startStr = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].substring(0, 3)}`
    const endStr = `${end.getDate()} ${MONTH_NAMES[end.getMonth()].substring(0, 3)}`
    return `${startStr} - ${endStr}`
  }, [refDate, period])

  const filtered = useMemo(() => {
    let start: Date;
    let end: Date;

    if (period === 'semana') {
      start = startOfWeek(refDate);
      end = endOfWeek(refDate);
    } else {
      end = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999)
      start = new Date(end)
    }

    return transactions.filter(tx => {
      if (tx.isAdjustment) return false // 👉 Ignorar ajustes de saldo nos totais
      if (!showPending && !tx.paid) return false
      const txDate = new Date(tx.date)

      if (period === 'semana') {
        return txDate >= start && txDate <= end
      } else if (period === 'mes') {
        return txDate.getMonth() === refDate.getMonth() && txDate.getFullYear() === refDate.getFullYear()
      } else {
        return txDate.getFullYear() === refDate.getFullYear()
      }
    })
  }, [transactions, period, showPending, refDate])

  const filteredDebito = useMemo(() => {
    return filtered.filter(tx => tx.paymentMethod !== 'credito')
  }, [filtered])

  const filteredCredito = useMemo(() => {
    return filtered.filter(tx => tx.paymentMethod === 'credito')
  }, [filtered])

  const chartTransactions = useMemo(() => {
    if (selectedChart === 'debito') return filteredDebito
    if (selectedChart === 'credito') return filteredCredito
    return filtered
  }, [selectedChart, filtered, filteredDebito, filteredCredito])

  const stats = useMemo(() => {
    const income = filtered.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0)
    
    // 👉 Filtramos apenas despesas que NÃO sejam de crédito (conforme solicitado)
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
      if (isCurrentMonth) {
        days = now.getDate()
      } else {
        days = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()
      }
    } else {
      const isCurrentYear = refDate.getFullYear() === now.getFullYear()
      if (isCurrentYear) {
        const startOfYear = new Date(now.getFullYear(), 0, 0)
        const diff = now.getTime() - startOfYear.getTime()
        days = Math.floor(diff / (1000 * 60 * 60 * 24)) || 1
      } else {
        days = 365
      }
    }

    return {
      income,
      expense,
      performance,
      economizadoPercent,
      diarioMedio: expense / days
    }
  }, [filtered, period, refDate])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Seletor de Período (Aba) */}
      <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
        {(['semana', 'mes', 'ano'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.segBtn, period === p && { backgroundColor: colors.card }]}
            onPress={() => {
              setPeriod(p)
              setRefDate(new Date())
            }}
          >
            <Text style={[styles.segBtnText, { color: period === p ? colors.foreground : colors.mutedForeground }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Navegador do Tempo */}
      <View style={[styles.periodNav, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={handlePrev} style={styles.navBtn}>
          <Ionicons name='chevron-back' size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.periodTitle, { color: colors.foreground }]}>{periodLabel}</Text>
        <TouchableOpacity onPress={handleNext} style={styles.navBtn}>
          <Ionicons name='chevron-forward' size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* INDICADORES DE PERFORMANCE */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Cálculos do período</Text>
      <View style={[styles.statsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>

        <View style={styles.statRow}>
          <View>
            <Text style={[styles.statLabel, { color: colors.foreground }]}>Performance</Text>
            <View style={styles.iconRow}>
              <Ionicons name="arrow-down-circle" size={14} color={colors.destructive} />
              <Ionicons name="arrow-up-circle" size={14} color={colors.success} />
            </View>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: stats.performance >= 0 ? colors.success : colors.destructive }]}>
              {formatCurrency(stats.performance)}
            </Text>
            <Text style={[styles.statStatus, { color: colors.mutedForeground }]}>
              {stats.performance >= 0 ? 'Sobrou dinheiro' : 'Faltou dinheiro'}
            </Text>
          </View>
        </View>

        <View style={[styles.statRow, styles.borderTop, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[styles.statLabel, { color: colors.foreground }]}>Economizado</Text>
            <View style={styles.iconRow}>
              <Ionicons name="leaf-outline" size={14} color={colors.success} />
            </View>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.economizadoPercent.toFixed(0)}%</Text>
            <Text style={[styles.statStatus, { color: colors.mutedForeground }]}>
              {stats.economizadoPercent > 0 ? 'Guardado' : 'Nada guardado'}
            </Text>
          </View>
        </View>

        <View style={[styles.statRow, styles.borderTop, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[styles.statLabel, { color: colors.foreground }]}>Custo de vida</Text>
            <View style={styles.iconRow}>
              <Ionicons name="cart-outline" size={14} color={colors.primary} />
            </View>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{formatCurrency(stats.expense)}</Text>
            <Text style={[styles.statStatus, { color: colors.mutedForeground }]}>
              {stats.expense > stats.income ? 'Acima da renda' : 'Dentro da renda'}
            </Text>
          </View>
        </View>

        <View style={[styles.statRow, styles.borderTop, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[styles.statLabel, { color: colors.foreground }]}>Diário médio</Text>
            <View style={styles.iconRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
            </View>
          </View>
          <View style={styles.statRight}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{formatCurrency(stats.diarioMedio)}</Text>
            <Text style={[styles.statStatus, { color: colors.mutedForeground }]}>Média de gastos</Text>
          </View>
        </View>
      </View>

      {/* 👉 GRÁFICO CONSOLIDADO COM SELETOR */}
      <CategoryDonutChart
        transactions={chartTransactions}
        title="Gastos por Categoria"
        headerComponent={
          <View style={[styles.chartSelector, { backgroundColor: colors.secondary }]}>
            {(['debito', 'credito', 'total'] as ChartFilter[]).map(cf => (
              <TouchableOpacity
                key={cf}
                style={[styles.chartSelectorBtn, selectedChart === cf && { backgroundColor: colors.card }]}
                onPress={() => setSelectedChart(cf)}
              >
                <Text style={[styles.chartSelectorText, { color: selectedChart === cf ? colors.foreground : colors.mutedForeground }]}>
                  {cf === 'debito' ? 'Débito' : cf === 'credito' ? 'Crédito' : 'Total'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnText: { fontSize: 13, fontWeight: '600' },

  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  periodTitle: { fontSize: 16, fontWeight: '700' },
  navBtn: { padding: 4 },

  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginLeft: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4, marginBottom: 8 },
  sectionTotal: { fontSize: 16, fontWeight: '700' },

  statsContainer: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  borderTop: { borderTopWidth: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 15, fontWeight: '600' },
  iconRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  statRight: { alignItems: 'flex-end' },
  statValue: { fontSize: 16, fontWeight: '700' },
  statStatus: { fontSize: 12, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14 },

  chartCard: { padding: 20, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth },
  stackedBarContainer: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 24 },

  chartSelector: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 12 },
  chartSelectorBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  chartSelectorText: { fontSize: 12, fontWeight: '600' },
})
