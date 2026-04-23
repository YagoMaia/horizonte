// components/BottomNavigation.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabType } from '@/constants/types'
import { useTheme } from '@/hooks/useTheme'

interface BottomNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  onAddClick: () => void
}

// 👉 Adicionamos 'cartao' aos LEFT_TABS e mantivemos o equilíbrio
const LEFT_TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'saldos', label: 'Saldos', icon: 'wallet-outline' },
  { id: 'cartao', label: 'Cartão', icon: 'card-outline' }, // Nova Aba
]

const RIGHT_TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'totais', label: 'Totais', icon: 'bar-chart-outline' },
  { id: 'menu', label: 'Menu', icon: 'menu-outline' },
]

// Nota: Se você ainda precisar da aba 'tags' no futuro, 
// pode movê-la para dentro da tela de Menu ou Totais.

export function BottomNavigation({ activeTab, onTabChange, onAddClick }: BottomNavigationProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const renderTab = (tab: { id: TabType; label: string; icon: string }) => (
    <TouchableOpacity
      key={tab.id}
      style={styles.tab}
      onPress={() => onTabChange(tab.id)}
      activeOpacity={0.7}
    >
      <Ionicons
        name={tab.icon as any}
        size={22}
        color={activeTab === tab.id ? colors.primary : colors.mutedForeground}
      />
      <Text style={[
        styles.tabLabel,
        { color: activeTab === tab.id ? colors.primary : colors.mutedForeground }
      ]}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  )

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom + 4,
      }
    ]}>
      {LEFT_TABS.map(renderTab)}

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={onAddClick}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {RIGHT_TABS.map(renderTab)}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#E64A19',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
})