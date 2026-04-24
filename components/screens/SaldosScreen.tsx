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

  const displayedTransactions = transactions
    .filter(tx => {
      if (showPending) return true
      return tx.paid === true
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
          {/* 👉 CORRIGIDO AQUI: de <div> para <View> */}
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

              const totalDebt = transactions
                .filter(tx => tx.accountId === acc.id && tx.paymentMethod === 'credito' && !tx.paid)
                .reduce((sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);

              let currentInvoice = 0;

              if (isCreditCard) {
                const today = new Date();
                const closingDay = acc.closingDay || 31;
                let targetMonth = today.getMonth() + 1;
                let targetYear = today.getFullYear();
                if (today.getDate() >= closingDay) targetMonth += 1;
                if (targetMonth > 11) { targetMonth -= 12; targetYear += 1; }

                currentInvoice = transactions
                  .filter(tx => {
                    if (tx.accountId !== acc.id || tx.paymentMethod !== 'credito' || tx.paid) return false;
                    const txDate = new Date(tx.date);
                    return txDate.getMonth() === targetMonth && txDate.getFullYear() === targetYear;
                  })
                  .reduce((sum, tx) => sum + (tx.type === 'receita' ? -tx.amount : tx.amount), 0);
              }

              const cardLimit = acc.creditLimit || (acc.balance > 0 ? acc.balance : 0);
              const availableLimit = Math.max(0, cardLimit - totalDebt);
              const mainDisplayValue = isCreditCard ? availableLimit : acc.balance;

              return (
                <View key={acc.id} style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.accountIcon, { backgroundColor: acc.color + '15' }]}>
                    <Ionicons name={acc.icon as any} size={18} color={acc.color} />
                  </View>
                  <View style={styles.accountTextContainer}>
                    <Text style={[styles.accountName, { color: colors.mutedForeground }]} numberOfLines={1}>{acc.name}</Text>
                    <Text style={[styles.accountBalance, { color: colors.foreground }]}>
                      {isCreditCard && cardLimit === 0 ? 'Lim. não definido' : formatCurrency(mainDisplayValue)}
                    </Text>
                    {isCreditCard && (
                      <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>
                        Fatura: {formatCurrency(currentInvoice)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Cabeçalho de Lançamentos */}
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

        {/* Lista Organizada por Data */}
        <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {displayedTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum lançamento</Text>
            </View>
          ) : (
            displayedTransactions.slice(0, 50).map((tx, idx, arr) => {
              const isLast = idx === arr.length - 1
              const isReceita = tx.type === 'receita'
              const isCredito = tx.paymentMethod === 'credito'
              const amountColor = isReceita ? colors.success : tx.type === 'transferencia' ? colors.primary : colors.destructive

              const tag = tx.tagIds?.length > 0 ? tags.find(t => t.id === tx.tagIds[0]) : null;
              const account = accounts.find(a => a.id === tx.accountId);

              const iconColor = tag ? tag.color : (isReceita ? colors.success : colors.destructive);
              const iconName = tag ? tag.icon : (isReceita ? 'arrow-up' : 'arrow-down');

              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txItem, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  onPress={() => setSelectedTx(tx)}
                  activeOpacity={0.7}
                >
                  {/* Ícone Redondo */}
                  <View style={[styles.txIcon, { backgroundColor: iconColor + '15' }]}>
                    <Ionicons name={iconName as any} size={18} color={iconColor} />
                  </View>

                  {/* Conteúdo Centralizado */}
                  <View style={styles.txInfo}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]} numberOfLines={1}>
                      {tx.description}
                    </Text>

                    {/* Metadados: Data em destaque + Categoria + Conta */}
                    <View style={styles.txMeta}>
                      <Text style={[styles.txDateText, { color: colors.primary }]}>
                        {formatDateShort(tx.date)}
                      </Text>

                      <View style={[styles.txDot, { backgroundColor: colors.border }]} />

                      <Text style={[styles.txMetaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {tag?.name || 'Sem categoria'}
                      </Text>

                      <View style={[styles.txDot, { backgroundColor: colors.border }]} />

                      <Text style={[styles.txMetaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {account?.name || 'Conta externa'}
                      </Text>
                    </View>
                  </View>

                  {/* Lado Direito: Valor e Badges */}
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: amountColor }]}>
                      {isReceita ? '+' : tx.type === 'transferencia' ? '' : '-'}{formatCurrency(tx.amount)}
                    </Text>

                    <View style={styles.badgesContainer}>
                      {isCredito && (
                        <View style={[styles.smallBadge, { backgroundColor: colors.secondary }]}>
                          <Text style={[styles.smallBadgeText, { color: colors.mutedForeground }]}>CRÉDITO</Text>
                        </View>
                      )}
                      {!tx.paid && (
                        <View style={[styles.smallBadge, { backgroundColor: colors.warningLight }]}>
                          <Text style={[styles.smallBadgeText, { color: colors.warning }]}>PREV</Text>
                        </View>
                      )}
                    </View>
                  </View>
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
  accountCard: { width: 140, borderRadius: 20, padding: 16, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'space-between', minHeight: 120 },
  accountIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  accountTextContainer: { gap: 2 },
  accountName: { fontSize: 13, fontWeight: '500' },
  accountBalance: { fontSize: 18, fontWeight: '600', letterSpacing: -0.5 },
  secondaryText: { fontSize: 11, fontWeight: '400', marginTop: 2 },
  txList: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  emptyState: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '500' },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  txIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 4 },
  txDesc: { fontSize: 15, fontWeight: '600' },
  txMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  txDateText: { fontSize: 12, fontWeight: '700' },
  txMetaText: { fontSize: 12, fontWeight: '400' },
  txDot: { width: 3, height: 3, borderRadius: 1.5 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  badgesContainer: { flexDirection: 'row', gap: 4 },
  smallBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  smallBadgeText: { fontSize: 9, fontWeight: '800' },
})