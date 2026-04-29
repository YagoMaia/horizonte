// components/BalanceChart.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '@/hooks/useTheme';
import { Transaction } from '@/constants/types';

interface BalanceChartProps {
    transactions: Transaction[];
    period: 'semana' | 'mes' | 'ano';
    refDate: Date;
}

export function BalanceChart({ transactions, period, refDate }: BalanceChartProps) {
    const { colors } = useTheme();
    const screenWidth = Dimensions.get('window').width;

    const chartData = useMemo(() => {
        const labels: string[] = [];
        const data: number[] = [];

        if (period === 'semana') {
            // 👉 LÓGICA SEMANAL: Últimos 7 dias
            for (let i = 6; i >= 0; i--) {
                const d = new Date(refDate);
                d.setDate(refDate.getDate() - i);

                labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

                const dayBalance = transactions
                    .filter(tx => {
                        const txDate = new Date(tx.date);
                        return (
                            txDate.getDate() === d.getDate() &&
                            txDate.getMonth() === d.getMonth() &&
                            txDate.getFullYear() === d.getFullYear() &&
                            tx.paid
                        );
                    })
                    .reduce((acc, tx) => acc + (tx.type === 'receita' ? tx.amount : -tx.amount), 0);

                data.push(dayBalance);
            }
        } else if (period === 'mes') {
            // 👉 LÓGICA MENSAL: Últimos 6 meses
            for (let i = 5; i >= 0; i--) {
                const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
                labels.push(`${d.getMonth() + 1}/${d.getFullYear().toString().substring(2)}`);

                const monthBalance = transactions
                    .filter(tx => {
                        const txDate = new Date(tx.date);
                        return (
                            txDate.getMonth() === d.getMonth() &&
                            txDate.getFullYear() === d.getFullYear() &&
                            tx.paid
                        );
                    })
                    .reduce((acc, tx) => acc + (tx.type === 'receita' ? tx.amount : -tx.amount), 0);

                data.push(monthBalance);
            }
        } else {
            // 👉 LÓGICA ANUAL: Os 12 meses do ano selecionado
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            months.forEach((m, index) => {
                labels.push(m);

                const monthBalance = transactions
                    .filter(tx => {
                        const txDate = new Date(tx.date);
                        return (
                            txDate.getMonth() === index &&
                            txDate.getFullYear() === refDate.getFullYear() &&
                            tx.paid
                        );
                    })
                    .reduce((acc, tx) => acc + (tx.type === 'receita' ? tx.amount : -tx.amount), 0);

                data.push(monthBalance);
            });
        }

        // Fallback para evitar erro de gráfico vazio
        const finalData = data.length > 0 ? data : [0];
        const finalLabels = labels.length > 0 ? labels : [''];

        return {
            labels: finalLabels,
            datasets: [{ data: finalData }]
        };
    }, [transactions, period, refDate]);

    const chartConfig = {
        backgroundColor: colors.card,
        backgroundGradientFrom: colors.card,
        backgroundGradientTo: colors.card,
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
        labelColor: (opacity = 1) => colors.mutedForeground,
        propsForDots: { r: '4', strokeWidth: '2', stroke: '#8B5CF6', fill: '#8B5CF6' },
        propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '0' }
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.foreground }]}>
                Balanço {period === 'semana' ? 'Diário' : 'Mensal'} do período
            </Text>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <LineChart
                    data={chartData}
                    width={screenWidth - 48}
                    height={220}
                    yLabelsOffset={5}
                    yAxisInterval={1}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    formatYLabel={(yValue) => {
                        const value = parseFloat(yValue);
                        if (value === 0) return 'R$ 0';
                        const sign = value > 0 ? '' : '-';
                        const absVal = Math.abs(value);
                        let formatted = absVal >= 1000 ? (absVal / 1000).toFixed(1) + 'k' : absVal.toFixed(0);
                        return `${sign}${formatted}`;
                    }}
                    // Ajuste para não amontoar as labels no modo anual
                    hidePointsAtIndex={period === 'ano' ? [1, 3, 5, 7, 9, 11] : []}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginVertical: 16 },
    title: { fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', opacity: 0.6 },
    card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
    chart: { marginTop: 16, borderRadius: 16, paddingRight: 35, marginLeft: 8, paddingBottom: 8, }
});