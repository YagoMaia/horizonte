// components/BalanceChart.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '@/hooks/useTheme';
import { Transaction } from '@/constants/types';

interface BalanceChartProps {
    transactions: Transaction[];
    period: 'semana' | 'mes' | 'ano';
    refDate: Date;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;
const HIDE_POINTS_ANO = [1, 3, 5, 7, 9, 11];
const HIDE_POINTS_EMPTY: number[] = [];

// Utilitário: gera chave YYYY-MM-DD a partir de Date (sem instanciar novos Date)
function toDateKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toMonthKey(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

// Extraída para evitar recriação de referência a cada render
function formatYLabel(yValue: string): string {
    const value = parseFloat(yValue);
    if (value === 0) return 'R$ 0';
    const sign = value > 0 ? '' : '-';
    const absVal = Math.abs(value);
    const formatted = absVal >= 1000 ? (absVal / 1000).toFixed(1) + 'k' : absVal.toFixed(0);
    return `${sign}${formatted}`;
}

export const BalanceChart = React.memo(({ transactions, period, refDate }: BalanceChartProps) => {
    const { colors } = useTheme();
    const { width: screenWidth } = useWindowDimensions();

    const chartData = useMemo(() => {
        const labels: string[] = [];
        const keys: string[] = [];

        if (period === 'semana') {
            // 👉 Gera 7 chaves YYYY-MM-DD
            for (let i = 6; i >= 0; i--) {
                const d = new Date(refDate);
                d.setDate(refDate.getDate() - i);
                labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
                keys.push(toDateKey(d));
            }

            // Agregação Single-Pass O(N) — sem new Date(tx.date)
            const balanceMap = new Map<string, number>();
            for (let i = 0; i < transactions.length; i++) {
                const tx = transactions[i];
                if (!tx.paid || !tx.date) continue;
                const txKey = tx.date.substring(0, 10);
                const delta = tx.type === 'receita' ? tx.amount : -tx.amount;
                balanceMap.set(txKey, (balanceMap.get(txKey) || 0) + delta);
            }

            const data = keys.map(k => balanceMap.get(k) || 0);
            return {
                labels: labels.length > 0 ? labels : [''],
                datasets: [{ data: data.length > 0 ? data : [0] }]
            };
        } else if (period === 'mes') {
            // 👉 Gera 6 chaves YYYY-MM para os últimos 6 meses
            for (let i = 5; i >= 0; i--) {
                const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
                labels.push(`${d.getMonth() + 1}/${d.getFullYear().toString().substring(2)}`);
                keys.push(toMonthKey(d.getFullYear(), d.getMonth()));
            }

            // Agregação Single-Pass O(N)
            const balanceMap = new Map<string, number>();
            for (let i = 0; i < transactions.length; i++) {
                const tx = transactions[i];
                if (!tx.paid || !tx.date) continue;
                const txMonthKey = tx.date.substring(0, 7);
                const delta = tx.type === 'receita' ? tx.amount : -tx.amount;
                balanceMap.set(txMonthKey, (balanceMap.get(txMonthKey) || 0) + delta);
            }

            const data = keys.map(k => balanceMap.get(k) || 0);
            return {
                labels: labels.length > 0 ? labels : [''],
                datasets: [{ data: data.length > 0 ? data : [0] }]
            };
        } else {
            // 👉 Anual: 12 chaves YYYY-MM para o ano corrente
            const targetYear = refDate.getFullYear();
            const targetYearStr = String(targetYear);

            for (let m = 0; m < 12; m++) {
                labels.push(MONTH_NAMES[m]);
                keys.push(toMonthKey(targetYear, m));
            }

            // Agregação Single-Pass O(N) filtrada pelo ano
            const balanceMap = new Map<string, number>();
            for (let i = 0; i < transactions.length; i++) {
                const tx = transactions[i];
                if (!tx.paid || !tx.date || !tx.date.startsWith(targetYearStr)) continue;
                const txMonthKey = tx.date.substring(0, 7);
                const delta = tx.type === 'receita' ? tx.amount : -tx.amount;
                balanceMap.set(txMonthKey, (balanceMap.get(txMonthKey) || 0) + delta);
            }

            const data = keys.map(k => balanceMap.get(k) || 0);
            return {
                labels: labels.length > 0 ? labels : [''],
                datasets: [{ data: data.length > 0 ? data : [0] }]
            };
        }
    }, [transactions, period, refDate]);

    const chartConfig = useMemo(() => ({
        backgroundColor: colors.card,
        backgroundGradientFrom: colors.card,
        backgroundGradientTo: colors.card,
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
        labelColor: () => colors.mutedForeground,
        propsForDots: { r: '4', strokeWidth: '2', stroke: '#8B5CF6', fill: '#8B5CF6' },
        propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '0' }
    }), [colors.card, colors.mutedForeground, colors.border]);

    const hidePointsAtIndex = period === 'ano' ? HIDE_POINTS_ANO : HIDE_POINTS_EMPTY;

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
                    formatYLabel={formatYLabel}
                    hidePointsAtIndex={hidePointsAtIndex}
                />
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    // Comparador customizado para evitar re-render quando refDate tem mesmo valor mas referência diferente
    return (
        prevProps.period === nextProps.period &&
        prevProps.refDate.getTime() === nextProps.refDate.getTime() &&
        prevProps.transactions === nextProps.transactions
    );
});

BalanceChart.displayName = 'BalanceChart';

const styles = StyleSheet.create({
    container: { marginVertical: 16 },
    title: { fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', opacity: 0.6 },
    card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
    chart: { marginTop: 16, borderRadius: 16, paddingRight: 35, marginLeft: 8, paddingBottom: 8, }
});