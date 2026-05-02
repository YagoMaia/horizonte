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

// 👉 IMPORTANDO O GRÁFICO AQUI
import { BalanceChart } from '../BalanceChart'

type Period = 'semana' | 'mes' | 'ano'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function TotaisScreen() {
  const { colors } = useTheme()
  const { transactions, tags, showPending } = useStoreContext()

  const [period, setPeriod] = useState<Period>('mes')
  const [view, setView] = useState<'despesas' | 'receitas'>('despesas')

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

    const end = new Date(refDate)
    const start = new Date(refDate)
    start.setDate(start.getDate() - 6)

    const startStr = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].substring(0, 3)}`
    const endStr = `${end.getDate()} ${MONTH_NAMES[end.getMonth()].substring(0, 3)}`
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

      if (period === 'semana') {
        return txDate >= start && txDate <= end
      } else if (period === 'mes') {
        return txDate.getMonth() === refDate.getMonth() && txDate.getFullYear() === refDate.getFullYear()
      } else {
        return txDate.getFullYear() === refDate.getFullYear()
      }
    })
  }, [transactions, period, showPending, refDate])

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

  const byTag = useMemo(() => {
    const targetType = view === 'despesas' ? 'despesa' : 'receita'
    
    // 👉 Filtramos apenas lançamentos que não sejam de crédito (débito/dinheiro)
    const relevant = filtered.filter(tx => {
      if (tx.type !== targetType) return false
      // Se for despesa, só mostramos o que NÃO for crédito (conforme solicitado pelo usuário)
      if (tx.type === 'despesa' && tx.paymentMethod === 'credito') return false
      return true
    })

    const totalView = relevant.reduce((sum, tx) => sum + tx.amount, 0)

    const map: Record<string, number> = {}
    relevant.forEach(tx => {
      if (tx.tagIds.length === 0) {
        map['sem-tag'] = (map['sem-tag'] || 0) + tx.amount
      } else {
        tx.tagIds.forEach(tagId => {
          map[tagId] = (map[tagId] || 0) + tx.amount
        })
      }
    })

    return Object.entries(map)
      .map(([tagId, amount]) => {
        const tag = tags.find(t => t.id === tagId)
        return {
          tagId,
          name: tag?.name ?? 'Sem tag',
          color: tag?.color ?? colors.border,
          icon: tag?.icon ?? 'list',
          amount,
          percent: totalView > 0 ? (amount / totalView) * 100 : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [filtered, view, tags, colors])

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

      {/* 👉 INSERINDO O GRÁFICO AQUI */}
      <BalanceChart
        transactions={transactions}
        period={period}
        refDate={refDate}
      />

      {/* View toggle (Despesas vs Receitas) */}
      <View style={[styles.segmented, { backgroundColor: colors.secondary, marginTop: 10 }]}>
        <TouchableOpacity
          style={[styles.segBtn, view === 'despesas' && { backgroundColor: colors.dangerLight }]}
          onPress={() => setView('despesas')}
        >
          <Text style={[styles.segBtnText, { color: view === 'despesas' ? colors.destructive : colors.mutedForeground }]}>Despesas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, view === 'receitas' && { backgroundColor: colors.successLight }]}
          onPress={() => setView('receitas')}
        >
          <Text style={[styles.segBtnText, { color: view === 'receitas' ? colors.success : colors.mutedForeground }]}>Receitas</Text>
        </TouchableOpacity>
      </View>

      {/* GRÁFICOS DE CATEGORIAS */}
      {byTag.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="pie-chart-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum lançamento</Text>
        </View>
      ) : (
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

          {/* Gráfico 1: Barra Empilhada */}
          <View style={styles.stackedBarContainer}>
            {byTag.map(item => (
              <View
                key={item.tagId}
                style={{
                  width: `${item.percent}%`,
                  backgroundColor: item.color,
                  height: '100%',
                }}
              />
            ))}
          </View>

          {/* Gráfico 2: Lista com Barras Horizontais */}
          <View style={styles.categoryList}>
            {byTag.map((item, idx) => (
              <View key={item.tagId} style={styles.categoryItem}>

                <View style={styles.catHeader}>
                  <View style={styles.catInfo}>
                    <View style={[styles.catIcon, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon as any} size={14} color={item.color} />
                    </View>
                    <Text style={[styles.catName, { color: colors.foreground }]}>{item.name}</Text>
                  </View>
                  <View style={styles.catValues}>
                    <Text style={[styles.catAmount, { color: colors.foreground }]}>{formatCurrency(item.amount)}</Text>
                    <Text style={[styles.catPercent, { color: colors.mutedForeground }]}>{item.percent.toFixed(1)}%</Text>
                  </View>
                </View>

                <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressBarFill, { width: `${item.percent}%` as any, backgroundColor: item.color }]} />
                </View>

              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnText: { fontSize: 13, fontWeight: '600' },

  // Estilo do novo Navegador do Tempo
  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  periodTitle: { fontSize: 16, fontWeight: '700' },
  navBtn: { padding: 4 },

  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginLeft: 4, marginTop: 8 },
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

  categoryList: { gap: 20 },
  categoryItem: { gap: 8 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 14, fontWeight: '600' },
  catValues: { alignItems: 'flex-end' },
  catAmount: { fontSize: 14, fontWeight: '700' },
  catPercent: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  progressBarBg: { height: 6, borderRadius: 3, width: '100%', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
})