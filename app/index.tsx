// app/index.tsx
import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useStoreContext } from '@/context/StoreContext'
import { TabType, Account } from '@/constants/types'
import { BottomNavigation } from '@/components/BottomNavigation'
import { SaldosScreen } from '@/components/screens/SaldosScreen'
import { TotaisScreen } from '@/components/screens/TotaisScreen'
import { HorizonteScreen } from '@/components/screens/HorizonteScreen'
import { ContasScreen } from '@/components/screens/ContasScreen'
import { MenuScreen } from '@/components/screens/MenuScreen'
import { CartaoScreen } from '@/components/screens/CartaoScreen'
import { ProjetosScreen } from '@/components/screens/ProjetosScreen'
import { Redirect, useRouter } from 'expo-router'

export default function HomePage() {
  const router = useRouter();
  const { colors } = useTheme()
  const store = useStoreContext()
  const [activeTab, setActiveTab] = useState<TabType>('saldos')

  // 👉 Estado para armazenar valores padrão dinâmicos para o modal
  const [defaultValues, setDefaultValues] = useState<{
    accountId?: string;
    type?: 'despesa' | 'receita' | 'transferencia';
  }>({});

  const handleSelectCard = useCallback((card: Account | null) => {
    const newAccountId = card?.id;
    const newType = card ? 'despesa' as const : undefined;

    if (defaultValues.accountId !== newAccountId || defaultValues.type !== newType) {
      if (card) {
        setDefaultValues({ accountId: newAccountId, type: newType });
      } else {
        setDefaultValues({});
      }
    }
  }, [defaultValues.accountId, defaultValues.type]);

  // 👉 Redireciona para onboarding se não foi visto
  if (!store.loading && !store.hasSeenOnboarding) {
    return <Redirect href="/onboarding" />
  }

  if (store.loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'saldos': return <SaldosScreen />
      case 'totais': return <TotaisScreen />
      case 'horizonte': return <HorizonteScreen />
      case 'contas': return <ContasScreen />
      case 'projetos': return <ProjetosScreen />
      case 'cartao': 
        return (
          <CartaoScreen 
            onSelectCard={handleSelectCard} 
          />
        )
      case 'menu': 
        return (
          <MenuScreen 
            onNavigateToAccounts={() => setActiveTab('contas')} 
            onNavigateToProjects={() => setActiveTab('projetos')}
          />
        )
      default: return <SaldosScreen />
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>H</Text>
          </View>
          <Text style={[styles.logoName, { color: colors.foreground }]}>Horizonte</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Horizonte shortcut */}
          <TouchableOpacity
            style={[
              styles.horizonBtn,
              { backgroundColor: activeTab === 'horizonte' ? colors.primary : colors.secondary }
            ]}
            onPress={() => {
              if (activeTab !== 'horizonte') setDefaultValues({});
              setActiveTab(activeTab === 'horizonte' ? 'saldos' : 'horizonte');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={activeTab === 'horizonte' ? '#FFF' : colors.mutedForeground}
            />
            <Text style={[
              styles.horizonBtnText,
              { color: activeTab === 'horizonte' ? '#FFF' : colors.mutedForeground }
            ]}>
              Horizonte
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* Bottom Nav */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'cartao') setDefaultValues({});
          setActiveTab(tab);
        }}
        onAddClick={() => {
          try {
            console.log("Navegando para tela de adição...");
            router.push({
              pathname: '/add-transaction',
              params: defaultValues
            });
          } catch (error) {
            console.error("Erro na navegação", error);
          }
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  logoName: { fontSize: 17, fontWeight: '600' },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  horizonBtnText: { fontSize: 13, fontWeight: '500' },
  content: { flex: 1 },
})