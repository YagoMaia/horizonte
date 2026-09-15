import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'

export function FeedbackBanner({ message, tone = 'success' }: { message: string; tone?: 'success' | 'error' | 'info' }) {
  const { colors } = useTheme()
  const color = tone === 'error' ? colors.destructive : tone === 'success' ? colors.success : colors.primaryText
  const background = tone === 'error' ? colors.dangerLight : tone === 'success' ? colors.successLight : colors.primarySoft
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: background }]}>
      <Ionicons name={tone === 'error' ? 'alert-circle-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'}
        size={21} color={color} accessible={false} />
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  )
}
const styles = StyleSheet.create({
  banner: { padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, fontSize: 14, lineHeight: 21 },
})
