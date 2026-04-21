// components/TransactionDetailModal.tsx
import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useStoreContext } from '@/context/StoreContext'
import { Transaction } from '@/constants/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface TransactionDetailModalProps {
  transaction: Transaction | null
  onClose: () => void
}

const RECURRENCE_LABELS: Record<string, string> = {
  unica: 'Única',
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
}

export function TransactionDetailModal({ transaction, onClose }: TransactionDetailModalProps) {
  const { colors } = useTheme()
  const { accounts, tags, deleteTransaction } = useStoreContext()
  const insets = useSafeAreaInsets()

  if (!transaction) return null

  const account = accounts.find(a => a.id === transaction.accountId)
  const txTags = tags.filter(t => transaction.tagIds.includes(t.id))
  const isReceita = transaction.type === 'receita'
  const isTransf = transaction.type === 'transferencia'
  const amountColor = isReceita ? colors.success : isTransf ? colors.primary : colors.destructive

  const handleDelete = () => {
    Alert.alert(
      'Excluir lançamento',
      `Deseja excluir "${transaction.description}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(transaction.id)
            onClose()
          },
        },
      ]
    )
  }

  return (
    <Modal
      visible={!!transaction}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Lançamento</Text>
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.destructive} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Amount hero */}
          <View style={[
            styles.amountHero,
            {
              backgroundColor: isReceita
                ? colors.successLight
                : isTransf
                ? colors.primary + '15'
                : colors.dangerLight,
            }
          ]}>
            <View style={[styles.typeIcon, { backgroundColor: amountColor }]}>
              <Ionicons
                name={isReceita ? 'arrow-up' : isTransf ? 'swap-horizontal' : 'arrow-down'}
                size={24}
                color="#FFF"
              />
            </View>
            <Text style={[styles.amountValue, { color: amountColor }]}>
              {isReceita ? '+' : isTransf ? '' : '-'}{formatCurrency(transaction.amount)}
            </Text>
            <Text style={[styles.amountDesc, { color: colors.foreground }]}>
              {transaction.description}
            </Text>
            <View style={[styles.statusBadge, {
              backgroundColor: transaction.paid ? colors.success + '20' : colors.warning + '20'
            }]}>
              <View style={[styles.statusDot, {
                backgroundColor: transaction.paid ? colors.success : colors.warning
              }]} />
              <Text style={[styles.statusText, {
                color: transaction.paid ? colors.success : colors.warning
              }]}>
                {transaction.paid ? 'Lançado' : 'Previsto'}
              </Text>
            </View>
          </View>

          {/* Details */}
          <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <DetailRow label="Data" value={formatDate(transaction.date)} colors={colors} />
            <DetailRow label="Tipo" value={
              transaction.type === 'receita' ? 'Receita' :
              transaction.type === 'despesa' ? 'Despesa' : 'Transferência'
            } colors={colors} />
            <DetailRow label="Conta" value={account?.name ?? '—'} colors={colors} />
            <DetailRow label="Recorrência" value={RECURRENCE_LABELS[transaction.recurrence] ?? '—'} colors={colors} />
            {txTags.length > 0 && (
              <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Tags</Text>
                <View style={styles.tagsRow}>
                  {txTags.map(tag => (
                    <View key={tag.id} style={[styles.tagChip, { backgroundColor: tag.color + '20' }]}>
                      <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                      <Text style={[styles.tagChipText, { color: tag.color }]}>{tag.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {transaction.notes && (
              <DetailRow label="Notas" value={transaction.notes} colors={colors} />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

function DetailRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  content: { padding: 20, gap: 16 },
  amountHero: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  typeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  amountDesc: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '500' },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: '500' },
  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagChipText: { fontSize: 12, fontWeight: '500' },
})
