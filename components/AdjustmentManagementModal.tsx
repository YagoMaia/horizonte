// components/AdjustmentManagementModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useStoreContext } from '@/context/StoreContext';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { Transaction } from '@/constants/types';

interface AdjustmentManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AdjustmentManagementModal({ visible, onClose }: AdjustmentManagementModalProps) {
  const { colors } = useTheme();
  const { transactions, accounts, deleteTransaction } = useStoreContext();

  const adjustments = transactions.filter(tx => tx.isAdjustment);

  const handleDelete = (tx: Transaction) => {
    const performDelete = async () => {
      await deleteTransaction(tx.id);
    };

    if (Platform.OS === 'web') {
      if (
        window.confirm(
          'Deseja realmente excluir este ajuste? O saldo da conta será revertido automaticamente.',
        )
      ) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Excluir Ajuste',
        'Deseja realmente excluir este ajuste? O saldo da conta será revertido automaticamente.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: performDelete,
          },
        ],
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Ajustes de Saldo</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {adjustments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="construct-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nenhum ajuste de saldo encontrado.
              </Text>
            </View>
          ) : (
            adjustments.map((tx) => {
              const account = accounts.find(a => a.id === tx.accountId);
              const isPositive = tx.type === 'receita';

              return (
                <View
                  key={tx.id}
                  style={[styles.adjustmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.cardInfo}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]}>{tx.description}</Text>
                    <Text style={[styles.txAccount, { color: colors.mutedForeground }]}>
                      {account?.name || 'Conta excluída'} • {formatDateShort(tx.date)}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={[styles.txAmount, { color: isPositive ? colors.success : colors.destructive }]}>
                      {isPositive ? '+' : '-'}{formatCurrency(tx.amount)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDelete(tx)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  adjustmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardInfo: { flex: 1, gap: 2 },
  txDesc: { fontSize: 15, fontWeight: '600' },
  txAccount: { fontSize: 12 },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  deleteBtn: { padding: 4 },
});
