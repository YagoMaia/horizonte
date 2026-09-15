import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabType } from '@/constants/types'
import { Layout } from '@/constants/theme'
import { useTheme } from '@/hooks/useTheme'

interface BottomNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  onAddClick: () => void
}
type NavigationTab = { id: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }
const LEFT_TABS: NavigationTab[] = [
  { id: 'saldos', label: 'Início', icon: 'wallet-outline' },
  { id: 'horizonte', label: 'Horizonte', icon: 'sunny-outline' },
]
const RIGHT_TABS: NavigationTab[] = [
  { id: 'metas', label: 'Metas', icon: 'flag-outline' },
  { id: 'menu', label: 'Menu', icon: 'grid-outline' },
]
export function BottomNavigation({ activeTab, onTabChange, onAddClick }: BottomNavigationProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const renderTab = (tab: NavigationTab) => {
    const selected = activeTab === tab.id
    return (
      <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => onTabChange(tab.id)}
        accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} activeOpacity={0.7}>
        <View style={[styles.tabIcon, { backgroundColor: selected ? colors.primarySoft : 'transparent' }]}>
          <Ionicons name={tab.icon} size={22} color={selected ? colors.primaryText : colors.mutedForeground} />
        </View>
        <Text style={[styles.tabLabel, { color: selected ? colors.primaryText : colors.mutedForeground,
          fontWeight: selected ? '700' : '500' }]}>{tab.label}</Text>
      </TouchableOpacity>
    )
  }
  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {LEFT_TABS.map(renderTab)}
        <TouchableOpacity style={styles.addTab} onPress={onAddClick} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel="Novo lançamento">
          <View style={[styles.addButton, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={27} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.tabLabel, { color: colors.foreground }]}>Novo</Text>
        </TouchableOpacity>
        {RIGHT_TABS.map(renderTab)}
      </View>
    </View>
  )
}
const styles = StyleSheet.create({
  safeArea: { paddingHorizontal: 12, paddingTop: 8 },
  container: { width: '100%', maxWidth: Layout.maxWidth, alignSelf: 'center', flexDirection: 'row',
    alignItems: 'center', padding: 6, borderRadius: 26, borderWidth: 1 },
  tab: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIcon: { width: 48, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, textAlign: 'center' },
  addTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 60 },
  addButton: { width: 44, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})
