// components/screens/reports/NetBalanceChart.tsx
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { useTheme } from '@/hooks/useTheme';
import { MonthlyData } from '@/hooks/useReportsData';

interface NetBalanceChartProps {
  monthlyData: MonthlyData[];
}

export const NetBalanceChart = React.memo(({ monthlyData }: NetBalanceChartProps) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  const labels = monthlyData.map((m) => m.label);
  const data = monthlyData.map((m) => m.netBalance);

  // Per-bar color functions: green for positive, red for negative
  const barColors = monthlyData.map((m) =>
    m.netBalance >= 0
      ? (_opacity: number) => colors.success
      : (_opacity: number) => colors.destructive
  );

  const chartData = {
    labels: labels.length > 0 ? labels : [''],
    datasets: [{
      data: data.length > 0 ? data : [0],
      colors: barColors.length > 0 ? barColors : [(_opacity: number) => colors.success],
    }],
  };

  const chartConfig = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => colors.mutedForeground,
    labelColor: (_opacity = 1) => colors.mutedForeground,
    barPercentage: 0.6,
    propsForBackgroundLines: {
      stroke: colors.border,
      strokeDasharray: '0',
    },
    formatYLabel: (yValue: string) => {
      const value = parseFloat(yValue);
      if (value === 0) return '0';
      const sign = value > 0 ? '' : '-';
      const absVal = Math.abs(value);
      const formatted = absVal >= 1000 ? (absVal / 1000).toFixed(1) + 'k' : absVal.toFixed(0);
      return `${sign}${formatted}`;
    },
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Saldo Líquido Mensal
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <BarChart
          data={chartData}
          width={screenWidth - 48}
          height={220}
          yAxisLabel="R$"
          yAxisSuffix=""
          chartConfig={chartConfig}
          style={styles.chart}
          showValuesOnTopOfBars={false}
          showBarTops={false}
          fromZero
          withCustomBarColorFromData
          flatColor
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chart: {
    marginTop: 16,
    borderRadius: 16,
    paddingRight: 35,
    marginLeft: 8,
    paddingBottom: 8,
  },
});
