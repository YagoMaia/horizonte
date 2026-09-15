import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Layout } from '@/constants/theme'

export interface AppButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  icon?: keyof typeof Ionicons.glyphMap
  loading?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

export function AppButton({ label, onPress, variant = 'primary', icon, loading = false,
  disabled = false, accessibilityLabel, style }: AppButtonProps) {
  const { colors } = useTheme()
  const blocked = disabled || loading
  const palette = {
    primary: [colors.primary, colors.primaryForeground],
    secondary: [colors.secondary, colors.foreground],
    danger: [colors.destructive, colors.destructiveForeground],
    ghost: ['transparent', colors.primaryText],
  }[variant]
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: loading }} disabled={blocked} onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: palette[0], opacity: blocked ? 0.6 : pressed ? 0.8 : 1 }, style]}>
      {loading ? <ActivityIndicator color={palette[1]} accessible={false} /> :
        icon ? <Ionicons name={icon} size={20} color={palette[1]} accessible={false} /> : null}
      <Text style={[styles.label, { color: palette[1] }]}>{loading ? 'Aguarde…' : label}</Text>
    </Pressable>
  )
}
const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 13, borderRadius: Layout.controlRadius,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
})
