import React from 'react'
import { View, ViewProps, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Layout } from '@/constants/theme'

export function SurfaceCard({ style, ...props }: ViewProps) {
  const { colors } = useTheme()
  return <View {...props} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]} />
}
const styles = StyleSheet.create({
  card: { padding: Layout.page, borderRadius: Layout.cardRadius, borderWidth: 1, gap: Layout.gap },
})
