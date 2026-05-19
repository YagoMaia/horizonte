// components/screens/reports/PeriodSelector.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { PeriodMonths } from '@/hooks/useReportsData'

interface PeriodSelectorProps {
  selectedPeriod: PeriodMonths
  onPeriodChange: (period: PeriodMonths) => void
}

const PERIOD_OPTIONS: { value: PeriodMonths; label: string }[] = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
]

export function PeriodSelector({ selectedPeriod, onPeriodChange }: PeriodSelectorProps) {
  const { colors } = useTheme()

  return (
    <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
      {PERIOD_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.segBtn,
            selectedPeriod === option.value && { backgroundColor: colors.card },
          ]}
          onPress={() => onPeriodChange(option.value)}
        >
          <Text
            style={[
              styles.segBtnText,
              {
                color:
                  selectedPeriod === option.value
                    ? colors.foreground
                    : colors.mutedForeground,
              },
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnText: { fontSize: 13, fontWeight: '600' },
})
