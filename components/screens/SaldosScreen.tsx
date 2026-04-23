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
import { Transaction, Account } from '@/constants/types'
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

        {/* Seção de Contas e Cartões */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contas e Cartões</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.accountsRow}>
            {accounts.map((acc: Account) => {
              const isCreditCard = acc.type === 'cartao_credito';

              let currentInvoice = 0;

              if (isCreditCard) {
                const today = new Date();
                const closingDay = acc.closingDay || 31;

                let targetMonth = today.getMonth() + 1;
                let targetYear = today.getFullYear();

                if (today.getDate() >= closingDay) {
                  targetMonth += 1;
                }
                if (targetMonth > 11) {
                  targetMonth -= 12;
                  targetYear += 1;
                }

                currentInvoice = transactions
                  .filter(tx => {
                    if (tx.accountId !== acc.id || tx.paymentMethod !== 'credito' || tx.paid) return false;
                    const txDate = new Date(tx.date);
                    return txDate.getMonth() === targetMonth && txDate.getFullYear() === targetYear;
                  })
                  .reduce((sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
              }

              const mainDisplayValue = isCreditCard ? currentInvoice : acc.balance;
              const cardLimit = acc.creditLimit || (acc.balance > 0 ? acc.balance : 0);

              // 👉 CORREÇÃO AQUI: Agora ele subtrai apenas a "currentInvoice", igualzinho à CartaoScreen!
              const availableLimit = Math.max(0, cardLimit - currentInvoice);

              return (
                <View key={acc.id} style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.accountIcon, { backgroundColor: acc.color + '15' }]}>
                    <Ionicons name={acc.icon as any} size={18} color={acc.color} />
                  </View>

                  <View style={styles.accountTextContainer}>
                    <Text style={[styles.accountName, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {acc.name}
                    </Text>

                    <Text style={[styles.accountBalance, { color: colors.foreground }]}>
                      {formatCurrency(mainDisplayValue)}
                    </Text>

                    {isCreditCard && (
                      <Text style={[styles.availableLimitText, { color: colors.mutedForeground }]}>
                        {cardLimit === 0 ? 'Lim. não definido' : `Disp. ${formatCurrency(availableLimit)}`}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Lançamentos Recentes */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lançamentos</Text>
          <View style={styles.filterToggle}>
            <Text style={[styles.filterText, { color: colors.mutedForeground }]}>Mostrar previstos</Text>
            <Switch
              value={showPending}
              onValueChange={setShowPending}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
              style={{ transform: [{ scale: 0.8 }] }}
            />
          </View>
        </View>

        {/* Lista de Transações */}
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
              const isCredito = tx.paymentMethod === 'credito'

              const amountColor = isReceita ? colors.success : tx.type === 'transferencia' ? colors.primary : colors.destructive
              const bgColor = isReceita ? colors.successLight : tx.type === 'transferencia' ? colors.primary + '15' : colors.dangerLight

              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txItem, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => setSelectedTx(tx)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.txIcon, { backgroundColor: bgColor }]}>
                    <Ionicons
                      name={isReceita ? 'arrow-up' : tx.type === 'transferencia' ? 'swap-horizontal' : 'arrow-down'}
                      size={16}
                      color={amountColor}
                    />
                  </View>

                  <View style={styles.txInfo}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                      {tx.description}
                    </Text>
                    <View style={styles.txMeta}>
                      <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{formatDateShort(tx.date)}</Text>
                      {isCredito && (
                        <View style={[styles.creditBadge, { backgroundColor: colors.secondary }]}>
                          <Text style={[styles.creditText, { color: colors.mutedForeground }]}>CRÉDITO</Text>
                        </View>
                      )}
                      {!tx.paid && (
                        <View style={[styles.pendingBadge, { backgroundColor: colors.warningLight }]}>
                          <Text style={[styles.pendingText, { color: colors.warning }]}>Prev</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text style={[styles.txAmount, { color: amountColor }]}>
                    {isReceita ? '+' : tx.type === 'transferencia' ? '' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                </TouchableOpacity>
              )
            })
          )}
        </View>
      </ScrollView>

      <TransactionDetailModal transaction={isEditing ? null : selectedTx} onClose={() => setSelectedTx(null)} onEdit={() => setIsEditing(true)} />
      {isEditing && selectedTx && (
        <AddTransactionModal visible={isEditing} onClose={() => { setIsEditing(false); setSelectedTx(null); }} onAdd={addTransaction} onUpdate={updateTransaction} accounts={accounts} tags={tags} transactionToEdit={selectedTx} />
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
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterText: { fontSize: 13, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },

  accountsRow: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  accountCard: {
    width: 140,
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
    minHeight: 120,
  },
  accountIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  accountTextContainer: { gap: 2 },
  accountName: { fontSize: 13, fontWeight: '500' },
  accountBalance: { fontSize: 18, fontWeight: '600', letterSpacing: -0.5 },
  availableLimitText: { fontSize: 11, fontWeight: '400', marginTop: 2 },

  txList: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  emptyState: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '500' },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txDesc: { fontSize: 15, fontWeight: '500' },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txDate: { fontSize: 12 },
  creditBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  creditText: { fontSize: 9, fontWeight: '700' },
  pendingBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pendingText: { fontSize: 9, fontWeight: '700' },
  txAmount: { fontSize: 15, fontWeight: '600' },
})