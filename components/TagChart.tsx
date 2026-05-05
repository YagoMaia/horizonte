import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Transaction } from '@/constants/types';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/lib/utils';
import { useStoreContext } from '@/context/StoreContext';

interface TagChartProps {
  transactions: Transaction[];
}

export function TagChart({ transactions }: TagChartProps) {
  const { colors } = useTheme();
  const { tags } = useStoreContext(); // 👉 Usando tags do contexto

  const data = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'despesa');
    const total = expenses.reduce((sum, t) => sum + t.amount, 0);

    const tagMap = new Map<string, number>();

    expenses.forEach(t => {
      const tagName = t.tag || 'Outros';
      tagMap.set(tagName, (tagMap.get(tagName) || 0) + t.amount);
    });

    const sorted = Array.from(tagMap.entries())
      .map(([name, value]) => {
        const tagInfo = tags.find(dt => dt.label === name) || tags.find(t => t.label === 'Outros');
        return {
          name,
          value,
          percent: total > 0 ? (value / total) * 100 : 0,
          color: tagInfo?.color || '#AFB1B6',
        };
      })
      .sort((a, b) => b.value - a.value);

    return { total, tags: sorted };
  }, [transactions, tags]);

  if (data.total === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Gastos por Categoria</Text>
      
      {/* Barra de progresso empilhada */}
      <View style={styles.barContainer}>
        {data.tags.map((tag, i) => (
          <View
            key={tag.name}
            style={[
              styles.barSegment,
              {
                backgroundColor: tag.color,
                flex: tag.percent,
                borderTopLeftRadius: i === 0 ? 8 : 0,
                borderBottomLeftRadius: i === 0 ? 8 : 0,
                borderTopRightRadius: i === data.tags.length - 1 ? 8 : 0,
                borderBottomRightRadius: i === data.tags.length - 1 ? 8 : 0,
              }
            ]}
          />
        ))}
      </View>

      {/* Legenda */}
      <View style={styles.legend}>
        {data.tags.map(tag => (
          <View key={tag.name} style={styles.legendItem}>
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: tag.color }]} />
              <Text style={[styles.tagName, { color: colors.foreground }]}>{tag.name}</Text>
              <Text style={[styles.tagPercent, { color: colors.mutedForeground }]}>{tag.percent.toFixed(0)}%</Text>
            </View>
            <Text style={[styles.tagValue, { color: colors.foreground }]}>{formatCurrency(tag.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
  },
  barContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 24,
  },
  barSegment: {
    height: '100%',
  },
  legend: {
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagName: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagPercent: {
    fontSize: 12,
  },
  tagValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
