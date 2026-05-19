// components/screens/reports/MonthlyEvolutionChart.tsx
import React, { useState } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import { useTheme } from '@/hooks/useTheme'
import { MonthlyData } from '@/hooks/useReportsData'

interface MonthlyEvolutionChartProps {
  monthlyData: MonthlyData[]
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  value: number
  datasetIndex: number
}

export function MonthlyEvolutionChart({ monthlyData }: MonthlyEvolutionChartProps) {
  const { colors } = useTheme()
  const screenWidth = Dimensions.get('window').width

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    value: 0,
    datasetIndex: 0,
  })

  const labels = monthlyData.map((d) => d.label)
  const incomeData = monthlyData.map((d) => d.income)
  const expenseData = monthlyData.map((d) => d.expense)

  // Ensure at least one data point to avoid chart errors
  const safeLabels = labels.length > 0 ? labels : ['']
  const safeIncome = incomeData.length > 0 ? incomeData : [0]
  const safeExpense = expenseData.length > 0 ? expenseData : [0]

  const chartData = {
    labels: safeLabels,
    datasets: [
      {
        data: safeIncome,
        color: (opacity = 1) => `rgba(56, 142, 60, ${opacity})`, // green
        strokeWidth: 2,
      },
      {
        data: safeExpense,
        color: (opacity = 1) => `rgba(211, 47, 47, ${opacity})`, // red
        strokeWidth: 2,
      },
    ],
    legend: ['Receitas', 'Despesas'],
  }

  const chartConfig = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => colors.mutedForeground,
    labelColor: () => colors.mutedForeground,
    propsForDots: { r: '4', strokeWidth: '1' },
    propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '0' },
  }

  const formatCurrency = (value: number): string => {
    if (value === 0) return 'R$ 0'
    const absVal = Math.abs(value)
    if (absVal >= 1000) {
      return `R$ ${(absVal / 1000).toFixed(1)}k`
    }
    return `R$ ${absVal.toFixed(0)}`
  }

  const handleDataPointClick = (data: {
    index: number
    value: number
    dataset: { data: number[] }
    x: number
    y: number
    getColor: (opacity: number) => string
  }) => {
    const datasetIndex = data.dataset.data === safeIncome ? 0 : 1
    setTooltip({
      visible: true,
      x: data.x,
      y: data.y,
      value: data.value,
      datasetIndex,
    })
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Evolução Mensal
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LineChart
          data={chartData}
          width={screenWidth - 48}
          height={220}
          yAxisInterval={1}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          formatYLabel={(yValue) => {
            const value = parseFloat(yValue)
            return formatCurrency(value)
          }}
          onDataPointClick={handleDataPointClick}
          decorator={() => {
            if (!tooltip.visible) return null
            const isIncome = tooltip.datasetIndex === 0
            const label = isIncome ? 'Receita' : 'Despesa'
            const tooltipColor = isIncome ? '#388E3C' : '#D32F2F'

            return (
              <View
                style={[
                  styles.tooltip,
                  {
                    left: tooltip.x - 50,
                    top: tooltip.y - 40,
                    backgroundColor: colors.card,
                    borderColor: tooltipColor,
                  },
                ]}
              >
                <Text style={[styles.tooltipLabel, { color: tooltipColor }]}>
                  {label}
                </Text>
                <Text style={[styles.tooltipValue, { color: colors.foreground }]}>
                  R$ {tooltip.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
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
  tooltip: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tooltipLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: '700',
  },
})
