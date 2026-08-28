import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, G, Text as SvgText, Line } from 'react-native-svg';
import { Transaction } from '@/constants/types';
import { useTheme } from '@/hooks/useTheme';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { formatCurrency } from '@/lib/utils';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(320);

  const data = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'despesa');
    let chartData: { label: string; value: number }[] = [];

    if (period === 'ano') {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      chartData = months.map((label) => ({ label, value: 0 }));
      expenses.forEach((tx) => {
        const date = new Date(tx.date);
        chartData[date.getMonth()].value += tx.amount;
      });
    } else if (period === 'mes') {
      chartData = [
        { label: 'S1', value: 0 },
        { label: 'S2', value: 0 },
        { label: 'S3', value: 0 },
        { label: 'S4', value: 0 },
      ];
      const daysInMonth = getDaysInMonth(refDate);
      if (daysInMonth > 28) chartData.push({ label: 'S5', value: 0 });

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
      const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
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
    return max > 0 ? max : 100;
  }, [data]);

  const totalSpent = useMemo(() => {
    return data.reduce((sum, d) => sum + d.value, 0);
  }, [data]);

  const chartHeight = 150;
  const paddingVertical = 20;
  const availableHeight = chartHeight - paddingVertical * 2;
  const barWidth = period === 'ano' ? 14 : period === 'mes' ? 32 : 24;
  const chartLeftMargin = 45;
  const chartRightMargin = 10;
  const SVG_WIDTH = 320;
  const chartInnerWidth = SVG_WIDTH - chartLeftMargin - chartRightMargin;

  const formatCompact = (num: number) => {
    if (num >= 1000000) return `R$${(num / 1000000).toFixed(1).replace('.0', '')}M`;
    if (num >= 1000) return `R$${(num / 1000).toFixed(1).replace('.0', '')}k`;
    return `R$${num.toFixed(2)}`;
  };

  const svgToRealX = (svgX: number) => (svgX / SVG_WIDTH) * containerWidth;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width - 40)}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>

      {selectedBar !== null && data[selectedBar] && (
        <View style={[styles.badge, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}>
          <Text style={[styles.badgeLabel, { color: colors.mutedForeground }]}>
            {data[selectedBar].label}:
          </Text>
          <Text style={[styles.badgeValue, { color: colors.primary }]}>
            {formatCompact(data[selectedBar].value)}
          </Text>
        </View>
      )}

      {totalSpent === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum gasto neste periodo</Text>
        </View>
      ) : (
        <View style={styles.chartContainer}>
          <Svg width="100%" height={chartHeight} viewBox={`0 0 ${SVG_WIDTH} ${chartHeight}`}>
            {Array.from({ length: 5 }, (_, i) => {
              const tickValue = Math.round((maxValue / 4) * i);
              const yPos = paddingVertical + ((4 - i) * availableHeight) / 4;
              return (
                <React.Fragment key={i}>
                  <SvgText x={chartLeftMargin - 8} y={yPos + 4} fontSize={10} fill={colors.mutedForeground} textAnchor="end">
                    {formatCompact(tickValue)}
                  </SvgText>
                  <Line x1={chartLeftMargin} y1={yPos} x2={SVG_WIDTH - chartRightMargin} y2={yPos} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
                </React.Fragment>
              );
            })}

            {data.map((item, index) => {
              const barHeight = (item.value / maxValue) * availableHeight;
              const y = chartHeight - paddingVertical - barHeight;
              const sectionWidth = chartInnerWidth / data.length;
              const centerX = chartLeftMargin + (index + 0.5) * sectionWidth;
              const isSelected = selectedBar === index;

              return (
                <G key={item.label}>
                  <Rect x={centerX - barWidth / 2} y={paddingVertical} width={barWidth} height={availableHeight} rx={barWidth / 2} fill={colors.border} opacity={0.3} />
                  {item.value > 0 && (
                    <Rect x={centerX - barWidth / 2} y={y} width={barWidth} height={barHeight} rx={barWidth / 2} fill={colors.primary} opacity={isSelected ? 1 : 0.7} />
                  )}
                  <SvgText x={centerX} y={chartHeight - 2} fontSize="10" fill={isSelected ? colors.primary : colors.mutedForeground} fontWeight={isSelected ? 'bold' : 'normal'} textAnchor="middle">
                    {item.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          <View style={[StyleSheet.absoluteFillObject, { flexDirection: 'row' }]}>
            <View style={{ width: svgToRealX(chartLeftMargin) }} />
            {data.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.6}
                style={{ width: svgToRealX(chartInnerWidth / data.length), height: chartHeight }}
                onPress={() => setSelectedBar(selectedBar === index ? null : index)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginBottom: 8 },
  badgeLabel: { fontSize: 13, fontWeight: '500' },
  badgeValue: { fontSize: 15, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, fontWeight: '500' },
  chartContainer: { marginTop: 16, width: '100%' },
});