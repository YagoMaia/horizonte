// components/screens/SaldosScreen.tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { useStoreContext } from '@/context/StoreContext'
import { Transaction } from '@/constants/types'
import { TransactionDetailModal } from '@/components/TransactionDetailModal'

export function SaldosScreen() {
  const { colors } = useTheme()
  const { accounts, transactions, totalBalance, monthlyIncome, monthlyExpense } = useStoreContext()
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Balance Card */}
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

        {/* Accounts */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Contas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.accountsRow}>
            {accounts.map(acc => (
              <View key={acc.id} style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.accountIcon, { backgroundColor: acc.color + '20' }]}>
                  <Ionicons name={acc.icon as any} size={20} color={acc.color} />
                </View>
                <Text style={[styles.accountName, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {acc.name}
                </Text>
                <Text style={[styles.accountBalance, { color: colors.foreground }]}>
                  {formatCurrency(acc.balance)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Recent Transactions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lançamentos Recentes</Text>
        <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {transactions.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nenhum lançamento ainda
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Toque no + para adicionar
              </Text>
            </View>
          )}
          {transactions.slice(0, 30).map((tx, idx) => {
            const isLast = idx === Math.min(transactions.length, 30) - 1
            const isReceita = tx.type === 'receita'
            const isTransf = tx.type === 'transferencia'
            const amountColor = isReceita ? colors.success : isTransf ? colors.primary : colors.destructive
            const amountSign = isReceita ? '+' : isTransf ? '↔' : '-'
            const bgColor = isReceita ? colors.successLight : isTransf ? colors.primary + '20' : colors.dangerLight

            return (
              <TouchableOpacity
                key={tx.id}
                style={[
                  styles.txItem,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
                ]}
                onPress={() => setSelectedTx(tx)}
                activeOpacity={0.7}
              >
                <View style={[styles.txIcon, { backgroundColor: bgColor }]}>
                  <Ionicons
                    name={isReceita ? 'arrow-up' : isTransf ? 'swap-horizontal' : 'arrow-down'}
                    size={16}
                    color={amountColor}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <View style={styles.txMeta}>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                      {formatDateShort(tx.date)}
                    </Text>
                    {!tx.paid && (
                      <View style={[styles.pendingBadge, { backgroundColor: colors.warningLight }]}>
                        <Text style={[styles.pendingText, { color: colors.warning }]}>Previsto</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.txAmount, { color: amountColor }]}>
                  {amountSign}{formatCurrency(tx.amount)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      <TransactionDetailModal
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  balanceCard: { borderRadius: 20, padding: 24, gap: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  balanceValue: { color: '#FFF', fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceStatText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  balanceDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.3)' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  accountsRow: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  accountCard: { width: 140, borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  accountIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accountName: { fontSize: 12, fontWeight: '500' },
  accountBalance: { fontSize: 16, fontWeight: '700' },
  txList: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  emptyState: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  emptyHint: { fontSize: 13 },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 3 },
  txDesc: { fontSize: 14, fontWeight: '500' },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txDate: { fontSize: 12 },
  pendingBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  pendingText: { fontSize: 10, fontWeight: '600' },
  txAmount: { fontSize: 15, fontWeight: '600' },
})
