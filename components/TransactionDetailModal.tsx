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
import { formatCurrency, formatDate, getTransactionVisuals } from '@/lib/utils'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

interface TransactionDetailModalProps {
  transaction: Transaction | null
  onClose: () => void
  onEdit?: (transaction: Transaction) => void
}

const RECURRENCE_LABELS: Record<string, string> = {
  unica: 'Única',
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
}

export function TransactionDetailModal({ transaction, onClose, onEdit }: TransactionDetailModalProps) {
  const { colors } = useTheme()
  const { accounts, deleteTransaction } = useStoreContext()
  const insets = useSafeAreaInsets()
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)

  if (!transaction) return null

  const account = accounts.find(a => a.id === transaction.accountId)
  const visuals = getTransactionVisuals(transaction.type, colors)

  const handleDelete = async () => {
    await deleteTransaction(transaction.id)
    onClose()
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(transaction)
    } else {
      Alert.alert('Editar', 'A funcionalidade de edição será implementada em breve!')
    }
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
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="pencil-outline" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={22} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Amount hero */}
          <View style={[
            styles.amountHero,
            {
              backgroundColor: visuals.bgColor,
            }
          ]}>
            <View style={[styles.typeIcon, { backgroundColor: visuals.color }]}>
              <Ionicons
                name={visuals.icon as any}
                size={28}
                color="#FFF"
              />
            </View>
            <Text style={[styles.amountValue, { color: visuals.color }]}>
              {visuals.prefix}{formatCurrency(transaction.amount)}
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
            {transaction.notes && (
              <DetailRow label="Notas" value={transaction.notes} colors={colors} />
            )}
          </View>
        </ScrollView>

        <ConfirmDeleteModal
          visible={showDeleteConfirm}
          title="Excluir lançamento?"
          description={`Tem certeza que deseja excluir "${transaction.description}"? Esta ação não pode ser desfeita.`}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
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
})