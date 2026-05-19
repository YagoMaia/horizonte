// components/screens/reports/ComparativeSummaryCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ComparativeSummary } from '@/hooks/useReportsData';
import { formatCurrency } from '@/lib/utils';

interface ComparativeSummaryCardProps {
  comparativeSummary: ComparativeSummary;
}

export function ComparativeSummaryCard({ comparativeSummary }: ComparativeSummaryCardProps) {
  const { colors } = useTheme();

  const {
    currentIncome,
    previousIncome,
    incomeVariation,
    currentExpense,
    previousExpense,
    expenseVariation,
    currentNetBalance,
    previousNetBalance,
  } = comparativeSummary;

  const netBalanceVariation =
    previousNetBalance !== 0
      ? ((currentNetBalance - previousNetBalance) / Math.abs(previousNetBalance)) * 100
      : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Comparativo Mensal</Text>

      {/* Income Row */}
      <ComparisonRow
        label="Receitas"
        currentValue={currentIncome}
        previousValue={previousIncome}
        variation={incomeVariation}
        colors={colors}
      />

      {/* Expenses Row */}
      <ComparisonRow
        label="Despesas"
        currentValue={currentExpense}
        previousValue={previousExpense}
        variation={expenseVariation}
        colors={colors}
      />

      {/* Net Balance Row */}
      <ComparisonRow
        label="Saldo Líquido"
        currentValue={currentNetBalance}
        previousValue={previousNetBalance}
        variation={netBalanceVariation}
        colors={colors}
        isLast
      />
    </View>
  );
}

interface ComparisonRowProps {
  label: string;
  currentValue: number;
  previousValue: number;
  variation: number;
  colors: ReturnType<typeof useTheme>['colors'];
  isLast?: boolean;
}

function ComparisonRow({
  label,
  currentValue,
  previousValue,
  variation,
  colors,
  isLast = false,
}: ComparisonRowProps) {
  const isPositive = variation >= 0;
  const variationColor = isPositive ? colors.success : colors.destructive;
  const arrowIcon = isPositive ? 'arrow-up' : 'arrow-down';

  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.rowHeader}>
        <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
        {variation !== 0 && (
          <View style={[styles.variationBadge, { backgroundColor: variationColor + '15' }]}>
            <Ionicons name={arrowIcon} size={12} color={variationColor} />
            <Text style={[styles.variationText, { color: variationColor }]}>
              {Math.abs(variation).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <View style={styles.valuesRow}>
        <View style={styles.valueBlock}>
          <Text style={[styles.valueLabel, { color: colors.mutedForeground }]}>Atual</Text>
          <Text style={[styles.valueAmount, { color: colors.foreground }]}>
            {formatCurrency(currentValue)}
          </Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={[styles.valueLabel, { color: colors.mutedForeground }]}>Anterior</Text>
          <Text style={[styles.valueAmount, { color: colors.mutedForeground }]}>
            {formatCurrency(previousValue)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    paddingVertical: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  variationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  variationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  valuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  valueBlock: {
    gap: 2,
  },
  valueLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  valueAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
});
