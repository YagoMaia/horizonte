// components/screens/ReportsScreen.tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { useReportsData, PeriodMonths } from '@/hooks/useReportsData'
import { PeriodSelector } from './reports/PeriodSelector'
import { MonthlyEvolutionChart } from './reports/MonthlyEvolutionChart'
import { NetBalanceChart } from './reports/NetBalanceChart'
import { ComparativeSummaryCard } from './reports/ComparativeSummaryCard'
import { AveragesCard } from './reports/AveragesCard'
import { TopTransactionsSection } from './reports/TopTransactionsSection'

export function ReportsScreen() {
  const { colors } = useTheme()
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodMonths>(6)

  const {
    monthlyData,
    comparativeSummary,
    averages,
    topExpenses,
    topIncomes,
    isEmpty,
    isLoading,
  } = useReportsData(selectedPeriod)

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Carregando relatórios...
        </Text>
      </View>
    )
  }

  if (isEmpty) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Adicione transações para ver seus relatórios
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PeriodSelector
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
      />

      <MonthlyEvolutionChart monthlyData={monthlyData} />

      <NetBalanceChart monthlyData={monthlyData} />

      <ComparativeSummaryCard comparativeSummary={comparativeSummary} />

      <View style={styles.spacer} />

      <AveragesCard averages={averages} />

      <View style={styles.spacer} />

      <TopTransactionsSection
        topExpenses={topExpenses}
        topIncomes={topIncomes}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  spacer: {
    height: 16,
  },
})
