// components/AdjustmentManagementModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
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
  const { transactions, accounts, deleteTransaction, updateTransaction } = useStoreContext();

  const adjustments = transactions.filter(tx => tx.isAdjustment);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'receita' | 'despesa'>('receita');

  const formatCurrencyMask = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const amountNumber = Number(cleanValue) / 100;
    return amountNumber.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingTx(tx);
    setEditDesc(tx.description);
    setEditAmount(formatCurrencyMask(String(Math.round(tx.amount * 100))));
    setEditType(tx.type as 'receita' | 'despesa');
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    const numericAmount = parseFloat(editAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Erro', 'Digite um valor válido maior que zero.');
      return;
    }

    const updatedTx: Transaction = {
      ...editingTx,
      description: editDesc.trim() || 'Ajuste de Saldo',
      amount: numericAmount,
      type: editType,
    };

    await updateTransaction(updatedTx, 'single');
    setEditingTx(null);
  };

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
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => handleEditClick(tx)} style={styles.actionBtn}>
                        <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(tx)} style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <Modal visible={!!editingTx} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Editar Ajuste</Text>
              
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Valor</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                  value={editAmount}
                  onChangeText={(text) => setEditAmount(formatCurrencyMask(text))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                />
              </View>

              <View style={[styles.typeSelector, { backgroundColor: colors.secondary }]}>
                <TouchableOpacity 
                  style={[styles.typeBtn, editType === 'receita' && { backgroundColor: colors.success }]} 
                  onPress={() => setEditType('receita')}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: editType === 'receita' ? '#FFF' : colors.mutedForeground }}>Receita (+)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, editType === 'despesa' && { backgroundColor: colors.destructive }]} 
                  onPress={() => setEditType('despesa')}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: editType === 'despesa' ? '#FFF' : colors.mutedForeground }}>Despesa (-)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingTx(null)}>
                  <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={handleSaveEdit}>
                  <Text style={styles.confirmBtnText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
  txAmount: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  actionBtn: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  amountInput: { fontSize: 32, fontWeight: '700', borderBottomWidth: 1, paddingBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  typeSelector: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4, marginTop: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});