import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, G, Text as SvgText, Line } from 'react-native-svg';
import { Transaction } from '@/constants/types';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/lib/utils';
import { startOfWeek, endOfWeek, getDate, getMonth, getYear, getDaysInMonth } from 'date-fns';

type Period = 'semana' | 'mes' | 'ano';

interface PeriodBarChartProps {
  transactions: Transaction[];
  period: Period;
  refDate: Date;
  title?: string;
}

export function PeriodBarChart({ transactions, period, refDate, title = 'Comparativo de Gastos' }: PeriodBarChartProps) {
  const { colors } = useTheme();

  const data = useMemo(() => {
    // Filtramos apenas despesas
    const expenses = transactions.filter((t) => t.type === 'despesa');
    let chartData: { label: string; value: number }[] = [];

    if (period === 'ano') {
      // 12 meses
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      chartData = months.map((label) => ({ label, value: 0 }));
      expenses.forEach((tx) => {
        const date = new Date(tx.date);
        chartData[date.getMonth()].value += tx.amount;
      });
    } else if (period === 'mes') {
      // Semanas do mês (S1: 1-7, S2: 8-14, S3: 15-21, S4: 22-28, S5: 29+)
      chartData = [
        { label: 'S1', value: 0 },
        { label: 'S2', value: 0 },
        { label: 'S3', value: 0 },
        { label: 'S4', value: 0 },
      ];
      
      const daysInMonth = getDaysInMonth(refDate);
      if (daysInMonth > 28) {
        chartData.push({ label: 'S5', value: 0 });
      }

      expenses.forEach((tx) => {
        const date = new Date(tx.date);
        const day = date.getDate();
        if (day <= 7) chartData[0].value += tx.amount;
        else if (day <= 14) chartData[1].value += tx.amount;
        else if (day <= 21) chartData[2].value += tx.amount;
        else if (day <= 28) chartData[3].value += tx.amount;
        else chartData[4].value += tx.amount;
      });
    } else if (period === 'semana') {
      // Dias da semana (Dom a Sáb)
      const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      chartData = weekDays.map((label) => ({ label, value: 0 }));
      expenses.forEach((tx) => {
        const date = new Date(tx.date);
        chartData[date.getDay()].value += tx.amount;
      });
    }

    return chartData;
  }, [transactions, period, refDate]);

  const maxValue = useMemo(() => {
    const max = Math.max(...data.map(d => d.value));
    return max > 0 ? max : 100; // Evitar divisão por zero
  }, [data]);

  const totalSpent = useMemo(() => {
    return data.reduce((sum, d) => sum + d.value, 0);
  }, [data]);

  const chartHeight = 150;
  const paddingVertical = 20;
  const availableHeight = chartHeight - paddingVertical * 2;
  const barWidth = period === 'ano' ? 14 : period === 'mes' ? 32 : 24;

  const formatCompact = (num: number) => {
    if (num >= 1000000) return `R$${(num / 1000000).toFixed(1).replace('.0', '')}M`;
    if (num >= 1000) return `R$${(num / 1000).toFixed(1).replace('.0', '')}k`;
    return `R$${num.toFixed(0)}`;
  };

  const chartLeftMargin = 45;
  const chartRightMargin = 10;
  const chartInnerWidth = 320 - chartLeftMargin - chartRightMargin;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>

      {totalSpent === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum gasto neste período</Text>
        </View>
      ) : (
        <View style={styles.chartContainer}>
          <Svg width="100%" height={chartHeight} viewBox={`0 0 320 ${chartHeight}`}>
            {/* Eixo Y Labels */}
            <SvgText x={chartLeftMargin - 8} y={paddingVertical + 4} fontSize="10" fill={colors.mutedForeground} textAnchor="end">
              {formatCompact(maxValue)}
            </SvgText>
            <SvgText x={chartLeftMargin - 8} y={chartHeight / 2 + 4} fontSize="10" fill={colors.mutedForeground} textAnchor="end">
              {formatCompact(maxValue / 2)}
            </SvgText>
            <SvgText x={chartLeftMargin - 8} y={chartHeight - paddingVertical + 4} fontSize="10" fill={colors.mutedForeground} textAnchor="end">
              R$0
            </SvgText>

            {/* Linhas de grade */}
            <Line x1={chartLeftMargin} y1={paddingVertical} x2={320 - chartRightMargin} y2={paddingVertical} stroke={colors.border} strokeWidth="1" strokeDasharray="4 4" opacity={0.5} />
            <Line x1={chartLeftMargin} y1={chartHeight / 2} x2={320 - chartRightMargin} y2={chartHeight / 2} stroke={colors.border} strokeWidth="1" strokeDasharray="4 4" opacity={0.5} />
            <Line x1={chartLeftMargin} y1={chartHeight - paddingVertical} x2={320 - chartRightMargin} y2={chartHeight - paddingVertical} stroke={colors.border} strokeWidth="1" opacity={0.5} />
            
            {data.map((item, index) => {
              const barHeight = (item.value / maxValue) * availableHeight;
              const y = chartHeight - paddingVertical - barHeight;
              
              // Largura e offset
              const sectionWidth = chartInnerWidth / data.length;
              const centerX = chartLeftMargin + (index + 0.5) * sectionWidth;

              return (
                <G key={item.label}>
                  {/* Barra de Fundo */}
                  <Rect
                    x={centerX - barWidth / 2}
                    y={paddingVertical}
                    width={barWidth}
                    height={availableHeight}
                    rx={barWidth / 2}
                    fill={colors.border}
                    opacity={0.3}
                  />
                  {/* Barra de Valor */}
                  {item.value > 0 && (
                    <Rect
                      x={centerX - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={barWidth / 2}
                      fill={colors.primary}
                    />
                  )}
                  {/* Label inferior */}
                  <SvgText
                    x={centerX}
                    y={chartHeight - 2}
                    fontSize="10"
                    fill={colors.mutedForeground}
                    textAnchor="middle"
                  >
                    {item.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
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
    marginTop: 16,
    width: '100%',
  },
});
