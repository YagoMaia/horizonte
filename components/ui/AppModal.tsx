import React from 'react'
import { Modal, View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Layout } from '@/constants/theme'

interface AppModalProps {
  visible: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  busy?: boolean
}
export function AppModal({ visible, title, onClose, children, busy = false }: AppModalProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const close = () => { if (!busy) onClose() }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={[styles.overlay, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} disabled={busy} accessible={false} />
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Fechar"
              accessibilityState={{ disabled: busy }} style={styles.close}>
              <Ionicons name="close" size={23} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            contentContainerStyle={styles.body} style={styles.scroll}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  panel: { width: '100%', maxWidth: 520, maxHeight: '100%', borderWidth: 1, borderRadius: Layout.cardRadius, overflow: 'hidden' },
  header: { paddingLeft: 20, paddingRight: 8, paddingVertical: 8, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 21, fontWeight: '700', letterSpacing: -0.5 },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { padding: 20, gap: 16 },
})
