import React, { forwardRef, useState } from 'react'
import { TextInput, TextInputProps, Text, View, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Layout } from '@/constants/theme'

interface FormFieldProps extends TextInputProps {
  label: string
  error?: string
  hint?: string
}
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, hint, style, onFocus, onBlur, accessibilityLabel, accessibilityHint, ...props }, ref
) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput {...props} ref={ref} accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error ?? accessibilityHint ?? hint}
        placeholderTextColor={colors.mutedForeground} selectionColor={colors.primaryText}
        onFocus={event => { setFocused(true); onFocus?.(event) }}
        onBlur={event => { setFocused(false); onBlur?.(event) }}
        style={[styles.input, { color: colors.foreground, backgroundColor: colors.background,
          borderColor: error ? colors.destructive : focused ? colors.ring : colors.border }, style]} />
      {(error || hint) && <Text accessibilityRole={error ? 'alert' : undefined}
        accessibilityLiveRegion={error ? 'polite' : 'none'}
        style={[styles.hint, { color: error ? colors.destructive : colors.mutedForeground }]}>{error ?? hint}</Text>}
    </View>
  )
})
const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: Layout.gap },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Layout.controlRadius, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16 },
  hint: { fontSize: 12, lineHeight: 18 },
})
