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
  const { transactions, tags } = useStoreContext()
  const [period, setPeriod] = useState<Period>('mes')
  const [view, setView] = useState<'despesas' | 'receitas'>('despesas')

  const filtered = useMemo(() => {
    const now = new Date()
    return transactions.filter(tx => {
      const txDate = new Date(tx.date)
      if (period === 'semana') {
        const weekAgo = new Date(now)
        weekAgo.setDate(now.getDate() - 7)
        return txDate >= weekAgo
      } else if (period === 'mes') {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
      } else {
        return txDate.getFullYear() === now.getFullYear()
      }
    })
  }, [transactions, period])

  const byTag = useMemo(() => {
    const targetType = view === 'despesas' ? 'despesa' : 'receita'
    const relevant = filtered.filter(tx => tx.type === targetType)
    const total = relevant.reduce((sum, tx) => sum + tx.amount, 0)

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
          percent: total > 0 ? (amount / total) * 100 : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [filtered, view, tags, colors])

  const total = byTag.reduce((s, i) => s + i.amount, 0)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Period selector */}
      <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
        {(['semana', 'mes', 'ano'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.segBtn, period === p && { backgroundColor: colors.card }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[
              styles.segBtnText,
              { color: period === p ? colors.foreground : colors.mutedForeground }
            ]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* View toggle */}
      <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
        <TouchableOpacity
          style={[styles.segBtn, view === 'despesas' && { backgroundColor: colors.dangerLight }]}
          onPress={() => setView('despesas')}
        >
          <Text style={[styles.segBtnText, { color: view === 'despesas' ? colors.destructive : colors.mutedForeground }]}>
            Despesas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, view === 'receitas' && { backgroundColor: colors.successLight }]}
          onPress={() => setView('receitas')}
        >
          <Text style={[styles.segBtnText, { color: view === 'receitas' ? colors.success : colors.mutedForeground }]}>
            Receitas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={[styles.summaryCard, { backgroundColor: view === 'despesas' ? colors.dangerLight : colors.successLight }]}>
        <Text style={[styles.summaryLabel, { color: view === 'despesas' ? colors.destructive : colors.success }]}>
          Total de {view}
        </Text>
        <Text style={[styles.summaryValue, { color: view === 'despesas' ? colors.destructive : colors.success }]}>
          {formatCurrency(total)}
        </Text>
      </View>

      {/* By tag breakdown */}
      {byTag.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="pie-chart-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Nenhum lançamento nesse período
          </Text>
        </View>
      ) : (
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {byTag.map((item, idx) => (
            <View
              key={item.tagId}
              style={[
                styles.listItem,
                idx < byTag.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
              ]}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.tagDot, { backgroundColor: item.color }]} />
                <Text style={[styles.tagName, { color: colors.foreground }]}>{item.name}</Text>
              </View>
              <View style={styles.listItemRight}>
                <Text style={[styles.tagAmount, { color: colors.foreground }]}>
                  {formatCurrency(item.amount)}
                </Text>
                <Text style={[styles.tagPercent, { color: colors.mutedForeground }]}>
                  {item.percent.toFixed(1)}%
                </Text>
              </View>
              {/* Progress bar */}
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
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  list: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    padding: 16,
    gap: 8,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tagName: {
    fontSize: 14,
    fontWeight: '500',
  },
  listItemRight: {
    position: 'absolute',
    right: 16,
    top: 16,
    alignItems: 'flex-end',
  },
  tagAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagPercent: {
    fontSize: 11,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
})
