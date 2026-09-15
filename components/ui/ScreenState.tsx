import React from 'react'
import { ActivityIndicator, Image, ImageSourcePropType, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { SurfaceCard } from './SurfaceCard'
import { AppButton, AppButtonProps } from './AppButton'

interface ScreenStateProps {
  kind?: 'empty' | 'loading' | 'error'
  title: string
  description?: string
  image?: ImageSourcePropType
  action?: AppButtonProps
}
export function ScreenState({ kind = 'empty', title, description, image, action }: ScreenStateProps) {
  const { colors } = useTheme()
  return (
    <SurfaceCard style={styles.card}>
      {kind === 'loading' ? <ActivityIndicator size="large" color={colors.primaryText} accessibilityLabel="Carregando" /> :
        image ? <Image source={image} style={styles.image} resizeMode="contain" accessible={false} importantForAccessibility="no" /> :
        <Ionicons name={kind === 'error' ? 'alert-circle-outline' : 'file-tray-outline'} size={40}
          color={kind === 'error' ? colors.destructive : colors.primaryText} accessible={false} />}
      <Text accessibilityRole={kind === 'error' ? 'alert' : 'header'} accessibilityLiveRegion="polite"
        style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {description && <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>}
      {action && <AppButton {...action} />}
    </SurfaceCard>
  )
}
const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 28 },
  title: { fontSize: 21, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  description: { fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  image: { width: 216, maxWidth: '100%', height: 216 },
})
