// app/index.tsx
import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useStoreContext } from '@/context/StoreContext'
import { TabType, Account, SavingsGoal } from '@/constants/types'
import { BottomNavigation } from '@/components/BottomNavigation'
import { AddTransactionModal } from '@/components/AddTransactionModal'
import { SaldosScreen } from '@/components/screens/SaldosScreen'
import { HorizonteScreen } from '@/components/screens/HorizonteScreen'
import { ContasScreen } from '@/components/screens/ContasScreen'
import { MenuScreen } from '@/components/screens/MenuScreen'
import { CartaoScreen } from '@/components/screens/CartaoScreen'
import { GoalsScreen } from '@/components/screens/GoalsScreen'
import { GoalDetailScreen } from '@/components/screens/GoalDetailScreen'
import { ReportsScreen } from '@/components/screens/ReportsScreen'
import { OrcamentoScreen } from '@/components/screens/OrcamentoScreen'
import { useSavingsGoals } from '@/hooks/useSavingsGoals'
import { useTrips } from '@/hooks/useTrips'
import { ViagensScreen } from '@/components/screens/ViagensScreen'
import { TripDetailScreen } from '@/components/screens/TripDetailScreen'
import { TripFormModal } from '@/components/TripFormModal'
import { Trip } from '@/constants/types'

export default function HomePage() {
  const { colors } = useTheme()
  const store = useStoreContext()
  const savingsGoalsProps = useSavingsGoals()
  const tripsProps = useTrips()
  const { goals, deposits, processOverdueRecurrences, syncWithTransactions, addDeposit } = savingsGoalsProps
  const [activeTab, setActiveTab] = useState<TabType>('saldos')
  const [modalVisible, setModalVisible] = useState(false)
  const [tripFormVisible, setTripFormVisible] = useState(false)
  
  // Internal navigation state for "metas" tab (stores selected goal object)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)

  // Internal navigation state for "viagens" tab
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [tripToEdit, setTripToEdit] = useState<Trip | undefined>()

  // 👉 Estado para armazenar valores padrão dinâmicos para o modal
  const [defaultValues, setDefaultValues] = useState<{
    accountId?: string;
    type?: 'despesa' | 'receita' | 'transferencia';
    tripId?: string;
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

  // Process recurring goal deposits & sync transactions on app startup and changes
  useEffect(() => {
    if (!store.loading) {
      processOverdueRecurrences(store.addTransaction);
      syncWithTransactions(store.transactions);
    }
  }, [store.loading, store.transactions, store.addTransaction, processOverdueRecurrences, syncWithTransactions]);

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
      case 'horizonte': return <HorizonteScreen />
      case 'contas': return <ContasScreen />
      case 'cartao': 
        return (
          <CartaoScreen 
            onSelectCard={handleSelectCard} 
          />
        )
      case 'metas':
        if (selectedGoal) {
          const goalDeposits = deposits.filter((d) => d.goalId === selectedGoal.id)
          return (
            <GoalDetailScreen
              goal={selectedGoal}
              onBack={() => setSelectedGoal(null)}
              deposits={goalDeposits}
              goals={savingsGoalsProps.goals}
              recurrences={savingsGoalsProps.recurrences}
              addDeposit={savingsGoalsProps.addDeposit}
              addWithdrawal={savingsGoalsProps.addWithdrawal}
              deleteDeposit={savingsGoalsProps.deleteDeposit}
              updateGoal={savingsGoalsProps.updateGoal}
              deleteGoal={savingsGoalsProps.deleteGoal}
              createRecurrence={savingsGoalsProps.createRecurrence}
              cancelRecurrence={savingsGoalsProps.cancelRecurrence}
            />
          )
        }
        return (
          <GoalsScreen
            onGoalPress={(goal) => setSelectedGoal(goal)}
            goals={savingsGoalsProps.goals}
            loading={savingsGoalsProps.loading}
            error={savingsGoalsProps.error}
            createGoal={savingsGoalsProps.createGoal}
            retry={savingsGoalsProps.retry}
          />
        )
      case 'relatorios': return <ReportsScreen />
      case 'orcamento': return <OrcamentoScreen />
      case 'menu': return (
        <MenuScreen
          onNavigate={(tab) => setActiveTab(tab)}
          trips={tripsProps.trips}
          onCreateTrip={() => {
            setTripToEdit(undefined);
            setActiveTab('viagens');
            setTripFormVisible(true);
          }}
          onAddTripExpense={(trip) => {
            setDefaultValues({ type: 'despesa', tripId: trip.id });
            setModalVisible(true);
          }}
        />
      )
      case 'viagens':
        if (selectedTrip) {
          return (
            <TripDetailScreen
              trip={selectedTrip}
              onBack={() => setSelectedTrip(null)}
              onEdit={() => {
                setTripToEdit(selectedTrip);
                setSelectedTrip(null);
              }}
              onDelete={() => Alert.alert(
                'Excluir viagem?',
                `A viagem “${selectedTrip.name}” será removida, mas as transações permanecerão no extrato.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Excluir', style: 'destructive', onPress: async () => {
                    await tripsProps.deleteTrip(selectedTrip.id);
                    setSelectedTrip(null);
                  } },
                ],
              )}
              onAddTransaction={() => {
                setDefaultValues({ type: 'despesa', tripId: selectedTrip.id });
                setModalVisible(true);
              }}
            />
          );
        }
        return (
          <ViagensScreen
            trips={tripsProps.trips}
            createTrip={tripsProps.createTrip}
            updateTrip={tripsProps.updateTrip}
            editTrip={tripToEdit}
            onEditConsumed={() => setTripToEdit(undefined)}
            onTripPress={(trip) => setSelectedTrip(trip)}
          />
        );
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
          {/* Contas shortcut */}
          <TouchableOpacity
            style={[
              styles.headerBtn,
              { backgroundColor: activeTab === 'contas' ? colors.primary + '20' : 'transparent' }
            ]}
            onPress={() => {
              if (activeTab !== 'contas') setDefaultValues({});
              setActiveTab(activeTab === 'contas' ? 'saldos' : 'contas');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="wallet-outline"
              size={20}
              color={activeTab === 'contas' ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>

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
          if (tab !== 'metas') setSelectedGoal(null);
          if (tab !== 'viagens') setSelectedTrip(null);
          setActiveTab(tab);
        }}
        onAddClick={() => setModalVisible(true)}
      />

      {/* Modal */}
      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={async (tx) => {
          try {
            await store.addTransaction(tx);
            
            if (tx.type === 'transferencia' && tx.targetAccountId?.startsWith('goal_')) {
              const goalId = tx.targetAccountId.replace('goal_', '');
              
              await addDeposit(goalId, tx.amount, tx.accountId);
            }
          } catch (error) {
            console.error('[DEBUG] index.tsx onAdd -> ERROR:', error);
          }
        }}
        accounts={store.accounts}
        initialAccountId={defaultValues.accountId}
        initialType={defaultValues.type}
        initialTripId={defaultValues.tripId}
        goals={goals}
        trips={tripsProps.trips}
      />

      <TripFormModal
        visible={tripFormVisible}
        onClose={() => setTripFormVisible(false)}
        onSubmit={async (input) => {
          await tripsProps.createTrip(input);
          setTripFormVisible(false);
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
