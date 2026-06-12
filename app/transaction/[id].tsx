import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RecurrenceActionModal } from '@/components/RecurrenceActionModal';
import { useLocalSearchParams, useRouter } from 'expo-router';

const RECURRENCE_LABELS: Record<string, string> = {
  unica: 'Única',
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
};

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { transactions, accounts, projects, goals, deleteTransaction } = useStoreContext();
  const insets = useSafeAreaInsets();
  
  const [recurrenceModalVisible, setRecurrenceModalVisible] = useState(false);

  const transaction = transactions.find((t) => t.id === id);

  useEffect(() => {
    if (!transaction) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  }, [transaction, router]);

  if (!transaction) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const account = accounts.find((a) => a.id === transaction.accountId);
  const project = projects.find((p) => p.id === transaction.projectId);
  const txGoals = goals.filter((g) => transaction.goalIds && transaction.goalIds.includes(g.id));
  const isReceita = transaction.type === 'receita';
  const isTransf = transaction.type === 'transferencia';
  const amountColor = isReceita ? colors.success : isTransf ? colors.primary : colors.destructive;

  const isFamily = !!(transaction.groupId || (transaction.id && String(transaction.id).includes('-')));

  const handleDelete = async () => {
    if (isFamily) {
      setRecurrenceModalVisible(true);
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Deseja excluir "${transaction.description || 'esta transação'}"?`);
      if (confirmed) {
        await deleteTransaction(transaction.id);
      }
    } else {
      Alert.alert(
        'Excluir lançamento',
        `Deseja excluir "${transaction.description || 'esta transação'}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              await deleteTransaction(transaction.id);
            },
          },
        ]
      );
    }
  };

  const handleRecurrenceSelect = async (mode: 'single' | 'future' | 'all') => {
    await deleteTransaction(transaction.id, mode);
    setRecurrenceModalVisible(false);
  };

  const handleEdit = () => {
    router.push({
      pathname: '/add-transaction',
      params: { txId: transaction.id }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Detalhes do Lançamento</Text>
        <View style={{ width: 24 }} />
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
            {isReceita ? '+' : isTransf ? '' : '-'}{formatCurrency(transaction.amount || 0)}
          </Text>
          <Text style={[styles.amountDesc, { color: colors.foreground }]}>
            {transaction.description || 'Sem descrição'}
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
          <DetailRow label="Data" value={transaction.date ? formatDate(transaction.date) : '—'} colors={colors} />
          <DetailRow label="Tipo" value={
            transaction.type === 'receita' ? 'Receita' :
              transaction.type === 'despesa' ? 'Despesa' : 'Transferência'
          } colors={colors} />
          <DetailRow label="Conta de Origem" value={account?.name || 'Conta não encontrada'} colors={colors} />
          {project && (
            <DetailRow label="Projeto" value={project.name || 'Projeto'} colors={colors} />
          )}
          {txGoals && txGoals.length > 0 && (
            <DetailRow label={txGoals.length > 1 ? "Metas Relacionadas" : "Meta Relacionada"} value={txGoals.map(g => g.name).join(', ')} colors={colors} />
          )}
          <DetailRow label="Recorrência" value={transaction.recurrence ? (RECURRENCE_LABELS[transaction.recurrence] || '—') : '—'} colors={colors} />
          {transaction.notes ? (
            <DetailRow label="Notas" value={transaction.notes} colors={colors} />
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton, { borderColor: colors.border, backgroundColor: colors.card }]} 
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={20} color={colors.foreground} />
            <Text style={[styles.actionButtonText, { color: colors.foreground }]}>Editar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton, { backgroundColor: colors.destructive }]} 
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color="#FFF" />
            <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <RecurrenceActionModal
        visible={recurrenceModalVisible}
        actionType="delete"
        onClose={() => setRecurrenceModalVisible(false)}
        onSelect={handleRecurrenceSelect}
      />
    </View>
  );
}

function DetailRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
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
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  editButton: {
    borderWidth: 1,
  },
  deleteButton: {
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});