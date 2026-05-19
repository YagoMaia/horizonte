// components/screens/reports/AveragesCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Averages } from '@/hooks/useReportsData';
import { formatCurrency } from '@/lib/utils';

interface AveragesCardProps {
  averages: Averages;
}

export function AveragesCard({ averages }: AveragesCardProps) {
  const { colors } = useTheme();

  const { avgIncome, avgExpense, avgNetBalance } = averages;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Médias (últimos 3 meses)</Text>

      {/* Average Income */}
      <AverageRow
        label="Receita Média"
        value={avgIncome}
        icon="arrow-up-circle"
        iconColor={colors.success}
        valueColor={colors.success}
        colors={colors}
      />

      {/* Average Expenses */}
      <AverageRow
        label="Despesa Média"
        value={avgExpense}
        icon="arrow-down-circle"
        iconColor={colors.destructive}
        valueColor={colors.destructive}
        colors={colors}
      />

      {/* Average Net Balance */}
      <AverageRow
        label="Saldo Líquido Médio"
        value={avgNetBalance}
        icon="wallet-outline"
        iconColor={avgNetBalance >= 0 ? colors.success : colors.destructive}
        valueColor={avgNetBalance >= 0 ? colors.success : colors.destructive}
        colors={colors}
        isLast
      />
    </View>
  );
}

interface AverageRowProps {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  valueColor: string;
  colors: ReturnType<typeof useTheme>['colors'];
  isLast?: boolean;
}

function AverageRow({
  label,
  value,
  icon,
  iconColor,
  valueColor,
  colors,
  isLast = false,
}: AverageRowProps) {
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, { color: valueColor }]}>
        {formatCurrency(value)}
      </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
  },
});
