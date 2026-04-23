// components/screens/SaldosScreen.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { useStoreContext } from '@/context/StoreContext'
import { Transaction } from '@/constants/types'
import { TransactionDetailModal } from '../TransactionDetailModal'
import { AddTransactionModal } from '../AddTransactionModal'

export function SaldosScreen() {
  const { colors } = useTheme()
  const {
    accounts,
    tags,
    transactions,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
    addTransaction,
    updateTransaction,
    loading,
    showPending,
    setShowPending
  } = useStoreContext()

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const displayedTransactions = transactions.filter(tx => {
    if (showPending) return true
    return tx.paid === true
  })

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Card de Saldo Total */}
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.balanceLabel}>Saldo Total</Text>
          <Text style={styles.balanceValue}>{formatCurrency(totalBalance)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Ionicons name="arrow-up-circle" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.balanceStatText}>{formatCurrency(monthlyIncome)}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Ionicons name="arrow-down-circle" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.balanceStatText}>{formatCurrency(monthlyExpense)}</Text>
            </View>
          </View>
        </View>

        {/* Seção de Contas */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.accountsRow}>
            {accounts.map(acc => {

              // 👉 VERIFICAÇÃO DE SEGURANÇA PARA CRÉDITO
              // Aqui filtramos APENAS o que realmente consome limite:
              const totalCreditConsumed = transactions.filter(tx =>
                tx.accountId === acc.id &&             // 1. Deve ser deste cartão específico
                tx.paymentMethod === 'credito' &&      // 2. Deve ser método Crédito
                tx.type === 'despesa'                  // 3. Deve ser uma Despesa
              ).reduce((sum, tx) => sum + tx.amount, 0);

              // Cálculo do Limite Disponível
              const displayBalance = acc.type === 'cartao_credito'
                ? Math.max(0, acc.balance - totalCreditConsumed)
                : acc.balance;

              return (
                <View key={acc.id} style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.accountIcon, { backgroundColor: acc.color + '20' }]}>
                    <Ionicons name={acc.icon as any} size={20} color={acc.color} />
                  </View>
                  <Text style={[styles.accountName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {acc.name}
                  </Text>
                  <Text style={[styles.accountBalance, { color: colors.foreground }]}>
                    {formatCurrency(displayBalance)}
                  </Text>
                  {/* Dica visual se for cartão */}
                  {acc.type === 'cartao_credito' && (
                    <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: -4 }}>LIMITE DISPONÍVEL</Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Lançamentos */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lançamentos</Text>
          <View style={styles.filterToggle}>
            <Text style={[styles.filterText, { color: colors.mutedForeground }]}>Mostrar previstos</Text>
            <Switch
              value={showPending}
              onValueChange={setShowPending}
              trackColor={{ false: colors.border, true: colors.primary }}
              style={{ transform: [{ scale: 0.8 }] }}
            />
          </View>
        </View>

        <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {displayedTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum lançamento</Text>
            </View>
          ) : (
            displayedTransactions.slice(0, 30).map((tx, idx, arr) => {
              const isLast = idx === arr.length - 1
              const isReceita = tx.type === 'receita'
              const amountColor = isReceita ? colors.success : tx.type === 'transferencia' ? colors.primary : colors.destructive
              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txItem, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => setSelectedTx(tx)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.txIcon, { backgroundColor: isReceita ? colors.successLight : colors.dangerLight }]}>
                    <Ionicons name={isReceita ? 'arrow-up' : 'arrow-down'} size={16} color={amountColor} />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{formatDateShort(tx.date)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: amountColor }]}>
                    {isReceita ? '+' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                </TouchableOpacity>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* Modais */}
      <TransactionDetailModal transaction={isEditing ? null : selectedTx} onClose={() => setSelectedTx(null)} onEdit={() => setIsEditing(true)} />
      {isEditing && selectedTx && (
        <AddTransactionModal
          visible={isEditing}
          onClose={() => { setIsEditing(false); setSelectedTx(null); }}
          onAdd={addTransaction}
          onUpdate={updateTransaction}
          accounts={accounts}
          tags={tags}
          transactionToEdit={selectedTx}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  balanceCard: { borderRadius: 20, padding: 24, gap: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  balanceValue: { color: '#FFF', fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceStatText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  balanceDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.3)' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterText: { fontSize: 13, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  accountsRow: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  accountCard: { width: 140, borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  accountIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accountName: { fontSize: 12, fontWeight: '500' },
  accountBalance: { fontSize: 16, fontWeight: '700' },
  txList: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  emptyState: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 3 },
  txDesc: { fontSize: 14, fontWeight: '500' },
  txDate: { fontSize: 12 },
  txAmount: { fontSize: 15, fontWeight: '600' },
})