import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'

interface ScreenHeadingProps {
  title: string
  subtitle: string
  action?: React.ReactNode
}

export function ScreenHeading({ title, subtitle, action }: ScreenHeadingProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.9 },
  subtitle: { fontSize: 13, lineHeight: 19 },
})
