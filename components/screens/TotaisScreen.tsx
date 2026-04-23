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

type Period = 'semana' | 'mes' | 'ano'

export function TotaisScreen() {
  const { colors } = useTheme()
  const { transactions, tags, showPending } = useStoreContext()
  const [period, setPeriod] = useState<Period>('mes')
  const [view, setView] = useState<'despesas' | 'receitas'>('despesas')

  // --- LÓGICA DE FILTRAGEM ---
  const filtered = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    return transactions.filter(tx => {
      if (!showPending && !tx.paid) return false
      const txDate = new Date(tx.date)

      if (period === 'semana') {
        return txDate >= weekAgo && txDate <= endOfToday
      } else if (period === 'mes') {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
      } else {
        return txDate.getFullYear() === now.getFullYear()
      }
    })
  }, [transactions, period, showPending])

  // --- CÁLCULOS DE PERFORMANCE ---
  const stats = useMemo(() => {
    const income = filtered.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0)
    const expense = filtered.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0)

    const performance = income - expense
    const economizadoPercent = income > 0 ? Math.max(0, (performance / income) * 100) : 0

    // Cálculo do Diário Médio (Baseado em dias passados no período)
    const now = new Date()
    let days = 1
    if (period === 'semana') days = 7
    else if (period === 'mes') days = now.getDate()
    else days = 365 // Simplificado para o ano

    return {
      income,
      expense,
      performance,
      economizadoPercent,
      diarioMedio: expense / days
    }
  }, [filtered, period])

  // --- AGRUPAMENTO POR TAG ---
  const byTag = useMemo(() => {
    const targetType = view === 'despesas' ? 'despesa' : 'receita'
    const relevant = filtered.filter(tx => tx.type === targetType)
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
          color: tag?.color ?? colors.mutedForeground,
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
      {/* Seletor de Período */}
      <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
        {(['semana', 'mes', 'ano'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.segBtn, period === p && { backgroundColor: colors.card }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.segBtnText, { color: period === p ? colors.foreground : colors.mutedForeground }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* --- NOVOS INDICADORES DE PERFORMANCE --- */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Cálculos do período</Text>
      <View style={[styles.statsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>

        {/* Performance */}
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

        {/* Economizado */}
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

        {/* Custo de Vida */}
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

        {/* Diário Médio */}
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

      {/* Gráfico de Categorias */}
      {byTag.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="pie-chart-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum lançamento</Text>
        </View>
      ) : (
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {byTag.map((item, idx) => (
            <View key={item.tagId} style={[styles.listItem, idx < byTag.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <View style={styles.listItemHeader}>
                <View style={styles.listItemLeft}>
                  <View style={[styles.tagDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.tagName, { color: colors.foreground }]}>{item.name}</Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={[styles.tagAmount, { color: colors.foreground }]}>{formatCurrency(item.amount)}</Text>
                  <Text style={[styles.tagPercent, { color: colors.mutedForeground }]}>{item.percent.toFixed(1)}%</Text>
                </View>
              </View>
              <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { width: `${item.percent}%` as any, backgroundColor: item.color }]} />
              </View>
            </View>
          ))}
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
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginLeft: 4, marginTop: 8 },

  // Estilos dos novos indicadores
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
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  listItem: { padding: 16, gap: 12 },
  listItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagDot: { width: 10, height: 10, borderRadius: 5 },
  tagName: { fontSize: 14, fontWeight: '500' },
  listItemRight: { alignItems: 'flex-end' },
  tagAmount: { fontSize: 14, fontWeight: '600' },
  tagPercent: { fontSize: 12, marginTop: 2 },
  progressBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
})