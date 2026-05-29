import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { Transaction } from '@/constants/types';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/lib/utils';
import { useStoreContext } from '@/context/StoreContext';

interface CategoryDonutChartProps {
  transactions: Transaction[];
  title?: string;
  headerComponent?: React.ReactNode;
  onCategoryPress?: (category: string) => void;
}

export function CategoryDonutChart({ transactions, title = 'Divisão por Categoria', headerComponent, onCategoryPress }: CategoryDonutChartProps) {
  const { colors } = useTheme();
  const { tags } = useStoreContext();

  const data = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'despesa');
    const total = expenses.reduce((sum, t) => sum + t.amount, 0);

    const tagMap = new Map<string, number>();

    expenses.forEach((t) => {
      const tagName = (t as any).tag || 'Outros';
      tagMap.set(tagName, (tagMap.get(tagName) || 0) + t.amount);
    });

    const sorted = Array.from(tagMap.entries())
      .map(([name, value]) => {
        const tagInfo = tags.find((dt) => dt.label === name) || tags.find((t) => t.label === 'Outros');
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

  const size = 200;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulator = 0;
  const gap = data.tags.length > 1 ? 4 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      
      {headerComponent}

      {data.total === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum gasto registrado</Text>
        </View>
      ) : (
        <>
          <View style={styles.chartContainer}>
            <View style={{ width: size, height: size }}>
              <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <G origin={`${cx}, ${cy}`} rotation="-90">
                  {/* Fundo da rosca opcional para dar um efeito de pista */}
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    stroke={colors.border}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    opacity={0.3}
                  />
                  
                  {data.tags.map((tag) => {
                    const arc = (tag.percent / 100) * circumference;
                    const drawnStroke = Math.max(0, arc - gap);

                    const circle = (
                      <Circle
                        key={tag.name}
                        cx={cx}
                        cy={cy}
                        r={radius}
                        stroke={tag.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${drawnStroke} ${circumference - drawnStroke}`}
                        strokeDashoffset={-accumulator}
                        strokeLinecap="butt"
                        fill="transparent"
                      />
                    );
                    
                    accumulator += arc;
                    return circle;
                  })}
                </G>
              </Svg>
              
              <View style={styles.centerTextContainer}>
                <Text style={[styles.centerLabel, { color: colors.mutedForeground }]}>Total</Text>
                <Text style={[styles.centerValue, { color: colors.foreground }]}>
                  {formatCurrency(data.total)}
                </Text>
              </View>
            </View>
          </View>

          {/* Legenda */}
          <View style={styles.legend}>
            {data.tags.map((tag) => (
              <TouchableOpacity 
                key={tag.name} 
                style={styles.legendItemBtn}
                onPress={() => {
                  if (onCategoryPress) onCategoryPress(tag.name);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: tag.color }]} />
                  <Text style={[styles.tagName, { color: colors.foreground }]}>{tag.name}</Text>
                  <Text style={[styles.tagPercent, { color: colors.mutedForeground }]}>
                    {tag.percent.toFixed(0)}%
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.tagValue, { color: colors.foreground }]}>
                    {formatCurrency(tag.value)}
                  </Text>
                  {onCategoryPress && (
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
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
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
    position: 'relative',
  },
  centerTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  centerValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  legend: {
    gap: 8,
  },
  legendItemBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.1)',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
